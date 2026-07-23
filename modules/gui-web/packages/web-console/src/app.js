const bindings = new Map();
const actionButtons = new Map();
const selectedMessageIds = new Set();
const pendingFileAttachments = [];
const composerDraftPrefix = "coolzhu.composer.draft.";
const chatRecipientStoragePrefix = "coolzhu.chat.recipients.v1.";

let agentRegistry = { agents: [], active_agent_ids: [] };
let sessionRegistry = { sessions: [], active_session_id: null, max_sessions: 10 };
let avatarManifest = [];
let avatarManifestByFile = new Map();
const DEFAULT_WUXIA_AVATAR_PATH = "assets/avatars/wuxia-v3/bamboo-swordsman.png";
const LEGACY_AVATAR_MIGRATIONS = new Map([
  ["assets/avatars/wuxia-swordsman.png", DEFAULT_WUXIA_AVATAR_PATH],
  ["assets/avatars/robot-gold.png", "assets/avatars/wuxia-v3/gold-commander.png"],
  ["assets/avatars/robot-cyan.png", "assets/avatars/wuxia-v3/jade-strategist.png"],
  ["assets/avatars/robot-green.png", "assets/avatars/wuxia-v3/mechanist.png"],
  ["assets/avatars/robot-purple.png", "assets/avatars/wuxia-v3/scripture-monk.png"],
  ["assets/avatars/robot-red.png", "assets/avatars/wuxia-v3/ink-shadow.png"],
  ["assets/avatars/mushroom-butler.png", "assets/avatars/wuxia-v3/wandering-physician.png"],
  ["assets/avatars/star-sprite.png", "assets/avatars/wuxia-v3/feather-guard.png"],
  ["assets/avatars/turtle-mechanic.png", "assets/avatars/wuxia-v3/mechanist.png"],
  ["assets/avatars/cat-black.png", "assets/avatars/wuxia-v3/ink-shadow.png"],
  ["assets/avatars/shiba-captain.png", "assets/avatars/wuxia-v3/gold-commander.png"],
  ["assets/avatars/astronaut-pixel.png", "assets/avatars/wuxia-v3/feather-guard.png"],
  ["assets/avatars/alien-jelly.png", "assets/avatars/wuxia-v3/jade-strategist.png"],
  ["assets/avatars/ai-core.png", "assets/avatars/wuxia-v3/scripture-monk.png"],
]);
const WUXIA_ICON_ALIASES = new Map([
  ["project-tree", "project"],
  ["settings", "settings"],
  ["chat", "chat"],
  ["screen-cast", "browser"],
  ["play-test", "media"],
  ["image-preview", "media"],
  ["cli", "terminal"],
  ["task-list", "tasks"],
  ["wheel", "tasks"],
  ["skill", "memory"],
  ["inner-vision", "vision"],
  ["warn-log", "logs"],
  ["info-log", "logs"],
  ["bot vision", "vision"],
  ["refresh", "refresh"],
  ["search", "search"],
  ["save", "save"],
  ["delete", "delete"],
  ["link", "link"],
  ["send", "send"],
  ["microphone", "microphone"],
  ["upload", "upload"],
  ["lock", "lock"],
  ["unlock", "unlock"],
  ["camera", "camera"],
  ["code", "diff"],
  ["folder", "folder"],
  ["file", "file"],
  ["collapse", "chevron"],
]);
let chatRoomRegistry = { rooms: [], active_room_id: null, max_rooms: 8 };
let chatRoster = { room_id: null, members: [] };
let chatHandoffs = [];
let taskPendingApprovals = [];
let taskAuditEntries = [];
let taskProtectedRules = [];
let taskGoals = [];
let taskRuntimeItems = [];
let realtimeSessionRuntimeTask = null;
let visionRealtimeRuntimeTask = null;
const videoRuntimeTasks = new Map(); // message_id -> 视频生成任务项（进度/时长/状态），完成或中断后移除
let taskFullAccessStatus = { active: false, ttl_secs_remaining: 0 };
let taskScheduleRegistry = { tasks: [], due_count: 0, dev_open_permissions: false };
let taskScheduleGoalRegistry = { goals: [] };
let goalEventSources = new Map();
const seenGoalEventIds = new Set();
const autoStartedGoalLoopIds = new Set();
let goalEventRefreshTimer = null;
let goalRefreshPollTimer = null;
let visionRealtimeEventSource = null;
let realtimeSessionEventSource = null;
let realtimeSessionEventRefreshTimer = null;
const realtimeSessionLastEvents = [];
let visionRealtimeLastStatus = {};
let visionRealtimeLastElements = [];
let visionRealtimeSelectedElement = null;
let visionRealtimeSelectedElementKey = "";
let goalRoleRegistry = { roles: [], commander_session_id: null, generated_at: null };
let activeSessionId = null;
let activeChatRoomId = null;
let activeChatAbortController = null;
let showUiServiceStatus = { enabled: false, running: false, pid: null, disabled: false };
let activeOverviewVisionAgent = null;
let activeWorkspaceKey = "default";
let messagePaging = { roomId: null, hasMore: false, nextBefore: null };
let toolCatalog = { categories: [], summary: null, notes: [] };
let toolDetailCache = new Map();
let toolCallStatuses = new Map();
let clawbotChannel = {
  status: null,
  commands: [],
  bindings: [],
  gatewayLogin: null,
  gatewayMetrics: null,
  sidecarHealth: null,
  sessionRegistry: null,
  roomRegistry: null,
  contacts: [],
  administrator: null,
  lastResult: null,
};
let clawbotLoginPollTimer = null;
let clawbotLoginPollInFlight = false;
let handoffDrawerOpen = false;
let selectedProjectPath = "";
let projectTreeRoot = null;
const expandedProjectPaths = new Set();
// IDE 工程窗口 · 阶段D：View/Diff 合并按钮状态机（plan §4.6）
let ideViewDiffMode = "view"; // "view" | "diff"
let ideDiffLeft = "";  // 当前 diff 左侧文件相对路径
let ideDiffRight = ""; // 当前 diff 右侧文件相对路径
// IDE 工程窗口 · 阶段E：多文件标签页（plan §4.7 / 规格6）
// tab: { id, kind:"view"|"diff", title, path, right?, active, payload }
//   view payload: { content, lang, meta }
//   diff payload: { rows, meta }
const IDE_TAB_MAX = 12;
const IDE_TABS_STORAGE_KEY = "coolzhu.ide.tabs.v1";
let ideState = { tabs: [], activeTabId: null };
let memoryWindowBeads = [];
let memoryWindowSelectedBeadId = null;
let memoryWindowSummary = null;
let memoryWindowPromptPreview = null;
let memoryWindowContextPreview = null;
let memoryWindowPreviewTimer = null;
const DEFAULT_BROWSER_SEARCH_ENGINE_URL = "https://www.baidu.com/s?wd={query}";
let browserRuntimeConfig = {
  browser: {
    search_engine_url: DEFAULT_BROWSER_SEARCH_ENGINE_URL,
  },
};
let activeBrowserHostName = "iframePreview";
let officeSceneState = null;
let visionLastLocate = null;
let realtimeSessionRunning = false;
let realtimeSessionStatus = null;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bind]").forEach((node) => {
    bindings.set(node.dataset.bind, node);
  });
  document.querySelectorAll("[data-action]").forEach((node) => {
    actionButtons.set(node.dataset.action, node);
  });
  initializeWorkbenchWindows();
  initializeBridgeVisualEffects();
  initClawbotSegments();

  actionButtons.get("capture")?.addEventListener("click", captureDesktop);
  actionButtons.get("stability-run")?.addEventListener("click", runStability);
  actionButtons.get("closed-loop")?.addEventListener("click", runClosedLoop);
  actionButtons.get("safe-click-test")?.addEventListener("click", runSafeClickTest);
  actionButtons.get("profile-run")?.addEventListener("click", runComputerUseProfile);
  actionButtons.get("send-message")?.addEventListener("click", sendMessage);
  actionButtons.get("showui-service-toggle")?.addEventListener("click", toggleShowUiService);
  actionButtons.get("task-card-chain")?.addEventListener("click", openCurrentTaskChain);
  actionButtons.get("composer-attach")?.addEventListener("click", () => {
    document.querySelector('[data-role="composer-file-input"]')?.click();
  });
  actionButtons.get("stt-dictate")?.addEventListener("click", sttDictateToggle);
  actionButtons.get("tts-speak")?.addEventListener("click", ttsSpeakLastMessage);
  actionButtons.get("allowed-root-add")?.addEventListener("click", allowedRootAdd);
  actionButtons.get("clawbot-refresh")?.addEventListener("click", () => refreshClawbotWindow({ silent: false }));
  actionButtons.get("clawbot-login-refresh")?.addEventListener("click", refreshClawbotLogin);
  actionButtons.get("clawbot-login-logout")?.addEventListener("click", logoutClawbotLogin);
  actionButtons.get("clawbot-save-binding")?.addEventListener("click", saveClawbotBinding);
  actionButtons.get("clawbot-apply-command")?.addEventListener("click", applyClawbotCommandFromForm);
  actionButtons.get("clawbot-administrator-claim")?.addEventListener("click", claimClawbotAdministrator);
  actionButtons.get("clawbot-administrator-clear")?.addEventListener("click", clearClawbotAdministrator);
  for (const action of ["list", "info", "get", "write"]) {
    actionButtons.get(`clawbot-file-${action}`)?.addEventListener("click", () => runClawbotFileAction(action));
  }
  for (const action of ["refresh", "detail", "continue", "stop"]) {
    actionButtons.get(`clawbot-task-${action}`)?.addEventListener("click", () => runClawbotTaskAction(action));
  }
  document
    .querySelector('[data-role="clawbot-binding-list"]')
    ?.addEventListener("click", handleClawbotBindingListClick);
  window.addEventListener("beforeunload", stopClawbotLoginPolling);
  initTtsVoiceSelector();
  startRealtimeSessionEventStream();
  document.querySelectorAll('[data-action="audio-realtime-start"]').forEach((node) => {
    node.addEventListener("click", audioRealtimeStart);
  });
  document.querySelectorAll('[data-action="audio-realtime-stop"]').forEach((node) => {
    node.addEventListener("click", audioRealtimeStop);
  });
  document.querySelectorAll('[data-action="realtime-session-start"]').forEach((node) => {
    node.addEventListener("click", realtimeSessionStart);
  });
  document.querySelectorAll('[data-action="realtime-session-stop"]').forEach((node) => {
    node.addEventListener("click", realtimeSessionStop);
  });
  actionButtons.get("realtime-model-probe")?.addEventListener("click", realtimeModelStreamProbe);
  actionButtons.get("realtime-tts-probe")?.addEventListener("click", realtimeTtsProbe);
  actionButtons.get("open-dispatch-diagnostics")?.addEventListener("click", openDispatchDiagnostics);
  actionButtons.get("session-new")?.addEventListener("click", createSession);
  actionButtons.get("session-save")?.addEventListener("click", saveSelectedSession);
  actionButtons.get("session-reset")?.addEventListener("click", resetSelectedSession);
  actionButtons.get("session-delete")?.addEventListener("click", deleteSelectedSession);
  actionButtons.get("session-avatar-toggle")?.addEventListener("click", toggleAvatarPicker);
  actionButtons.get("goal-role-bootstrap")?.addEventListener("click", bootstrapGoalRoleSessions);
  actionButtons.get("goal-role-heartbeat")?.addEventListener("click", sendGoalRoleHeartbeat);
  actionButtons.get("goal-role-assign")?.addEventListener("click", applyGoalRoleAssignments);
  actionButtons.get("message-load-older")?.addEventListener("click", loadOlderMessages);
  actionButtons.get("message-delete-selected")?.addEventListener("click", deleteSelectedMessages);
  actionButtons.get("chat-room-new")?.addEventListener("click", createChatRoom);
  actionButtons.get("chat-room-rename")?.addEventListener("click", renameSelectedChatRoom);
  actionButtons.get("chat-room-delete")?.addEventListener("click", deleteSelectedChatRoom);
  actionButtons.get("chat-handoff-toggle")?.addEventListener("click", toggleHandoffDrawer);
  actionButtons.get("chat-handoff-manual")?.addEventListener("click", manualHandoffSelectedMessages);
  actionButtons.get("project-refresh")?.addEventListener("click", () => loadProjectTree());
  actionButtons.get("project-mode-toggle")?.addEventListener("click", () => toggleIdeViewDiffMode());
  document.querySelector('[data-role="ide-diff-right"]')?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitIdeDiffRightFromInput();
    }
  });

  const sessionTrigger = document.querySelector('[data-role="session-trigger"]');
  const sessionWrap = document.querySelector(".session-select-wrap");
  sessionTrigger?.addEventListener("click", () => sessionWrap?.classList.toggle("open"));
  const chatRoomTrigger = document.querySelector('[data-role="chat-room-trigger"]');
  const chatRoomWrap = document.querySelector(".chat-room-select-wrap");
  chatRoomTrigger?.addEventListener("click", (event) => {
    event.preventDefault();
    chatRoomWrap?.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".session-select-wrap")) {
      sessionWrap?.classList.remove("open");
    }
    if (!event.target.closest(".chat-room-select-wrap")) {
      chatRoomWrap?.classList.remove("open");
    }
    if (!event.target.closest(".agent-dropdown-wrap")) {
      document.querySelector(".agent-dropdown-wrap")?.classList.remove("open");
    }
    if (!event.target.closest(".avatar-config-field") && !event.target.closest('[data-role="avatar-picker"]')) {
      closeAvatarPicker();
    }
  });

  document.querySelector('[data-role="session-list"]')?.addEventListener("click", async (event) => {
    const option = event.target.closest("[data-session-id]");
    if (!option) {
      return;
    }
    activeSessionId = option.dataset.sessionId;
    const trigger = document.querySelector('[data-role="session-trigger"]');
    if (trigger) {
      trigger.textContent = option.textContent;
    }
    sessionWrap?.classList.remove("open");
    await openSelectedSession();
  });

  document.querySelector('[data-role="chat-room-list"]')?.addEventListener("click", async (event) => {
    const option = event.target.closest("[data-room-id]");
    if (!option) {
      return;
    }
    saveComposerDraft();
    activeChatRoomId = option.dataset.roomId;
    chatRoomWrap?.classList.remove("open");
    await openSelectedChatRoom();
  });

  const agentTrigger = document.querySelector('[data-role="agent-trigger"]');
  agentTrigger?.addEventListener("click", () => {
    document.querySelector(".agent-dropdown-wrap")?.classList.toggle("open");
  });
  document.querySelector('[data-role="agent-targets"]')?.addEventListener("change", () => {
    updateAgentTriggerText();
    persistAgentTargets(activeChatRoomId);
  });

  // 视觉理解模型选择：设置窗口与总览共用同一 handler，选中即设为当前视觉理解会话（可随时更换）。
  const onVisionAgentChange = async (event) => {
    const agentId = event.target.value;
    try {
      await requestJson("/api/config/vision-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      await refreshState();
    } catch (error) {
      addMessage({ author: "视觉Agent", text: `切换失败：${error.message}`, kind: "thought", icon: "error-log" });
    }
  };
  document.querySelector('[data-role="settings-vision-agent"]')?.addEventListener("change", onVisionAgentChange);
  document.querySelector('[data-role="overview-vision-agent"]')?.addEventListener("change", onVisionAgentChange);

  document.querySelector('[data-role="tool-catalog"]')?.addEventListener("click", onToolCatalogClick);
  document.querySelectorAll('[data-action="tool-inventory-manage"]').forEach((node) => {
    node.addEventListener("click", onToolInventoryManage);
  });
  actionButtons.get("tool-dispatch-run")?.addEventListener("click", runToolSemanticDispatch);
  document.querySelector('[data-role="tool-dispatch-intent"]')?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runToolSemanticDispatch();
    }
  });
  document.querySelector('[data-role="composer-file-input"]')?.addEventListener("change", onComposerFilesSelected);
  document.querySelector('[data-role="composer-attachments"]')?.addEventListener("click", onComposerAttachmentClick);
  document.querySelector('[data-role="composer-references"]')?.addEventListener("click", onComposerReferenceClick);
  document.querySelector('[data-role="memory-bead-list"]')?.addEventListener("click", onMemoryBeadListClick);
  document.querySelector('[data-role="memory-constellation"]')?.addEventListener("click", onMemoryBeadListClick);
  document.querySelector('[data-role="memory-window-filters"]')?.addEventListener("input", memoryWindowApplyFilters);
  document.querySelector('[data-role="memory-window-filters"]')?.addEventListener("change", memoryWindowApplyFilters);
  actionButtons.get("memory-window-refresh")?.addEventListener("click", memoryWindowRefresh);
  actionButtons.get("browser-window-go")?.addEventListener("click", browserWindowNavigate);
  actionButtons.get("browser-window-reload")?.addEventListener("click", browserWindowReload);
  actionButtons.get("browser-window-back")?.addEventListener("click", browserWindowBack);
  actionButtons.get("browser-window-forward")?.addEventListener("click", browserWindowForward);
  actionButtons.get("browser-window-stop")?.addEventListener("click", browserWindowStop);
  actionButtons.get("browser-window-open-external")?.addEventListener("click", browserWindowOpenExternal);
  actionButtons.get("browser-proxy-save")?.addEventListener("click", browserProxySave);
  document.querySelector('[data-role="browser-window-input"]')?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      browserWindowNavigate();
    }
  });
  actionButtons.get("terminal-window-run")?.addEventListener("click", terminalWindowRunPowerShell);
  actionButtons.get("terminal-window-clear")?.addEventListener("click", terminalWindowClear);
  actionButtons.get("self-update-plan-refresh")?.addEventListener("click", refreshSelfUpdatePlan);
  document.querySelector('[data-role="project-tree"]')?.addEventListener("click", onProjectTreeClick);
  document.querySelector('[data-role="project-tree"]')?.addEventListener("dblclick", onProjectTreeDblClick);
  document.querySelector('[data-bind="project.path"]')?.addEventListener("dblclick", beginWorkspaceEdit);
  document.querySelector('[data-role="overview-workspace-name"]')?.addEventListener("click", copyOverviewWorkspacePath);

  window.addEventListener("resize", positionAvatarPicker);
  document.addEventListener("scroll", positionAvatarPicker, true);

  const providerSelect = document.querySelector('[data-role="session-provider"]');
  providerSelect?.addEventListener("change", () => {
    updateModelOptions();
    updateCustomProviderFields();
  });

  const modelSelect = document.querySelector('[data-role="session-model"]');
  modelSelect?.addEventListener("change", () => {
    renderModelTypeSelect();
    updateReasoningEffortOptions();
  });
  document.querySelector('[data-role="session-custom-model"]')?.addEventListener("input", () => {
    renderModelTypeSelect();
    updateReasoningEffortOptions();
  });

  const apiSecret = document.querySelector('[data-role="session-api-secret"]');
  apiSecret?.addEventListener("input", () => {
    apiSecret.dataset.saved = "0";
  });

  document.querySelector('[data-role="tool-exec-actions"] [class*="tool-exec-allow"]')?.addEventListener("click", async () => {
    hideToolExecButtons();
    if (!lastUserIntent) {
      addMessage({ author: "工具授权", text: "没有可执行的意图。", kind: "thought", icon: "error-log" });
      return;
    }
    addMessage({
      author: "工具授权",
      text: `已允许执行：${lastUserIntent}`,
      kind: "thought",
      icon: "success",
    });
    try {
      const response = await requestJson("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: lastUserIntent,
          execute: true,
          use_model: true,
          use_latest_capture: true,
        }),
      });
      addMessage({
        author: "系统工具执行 Agent",
        text: dispatchSummary(response),
        kind: "tool-summary",
        icon: "bot vision",
      });
    } catch (error) {
      addMessage({
        author: "工具授权",
        text: `执行失败：${error.message}`,
        kind: "thought",
        icon: "error-log",
      });
    }
  });

  document.querySelector('[data-role="tool-exec-actions"] [class*="tool-exec-deny"]')?.addEventListener("click", () => {
    hideToolExecButtons();
    addMessage({
      author: "工具授权",
      text: "已拒绝执行。",
      kind: "thought",
      icon: "error-log",
    });
  });
  updateModelOptions();
  refreshSystemInfo();
  refreshAudioStatus();
  refreshRealtimeSessionStatus();

  const messageInput = document.querySelector('[data-role="message-input"]');
  messageInput?.addEventListener("input", saveComposerDraft);
  messageInput?.addEventListener("paste", onComposerPaste);
  messageInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  restoreComposerDraft();

  chatMessageList()?.addEventListener("click", (event) => {
    if (event.target.closest(interactiveMessageSelector())) {
      return;
    }
    const article = event.target.closest(".message");
    if (!article?.dataset.messageId) {
      return;
    }
    article.classList.toggle("is-selected");
    if (article.classList.contains("is-selected")) {
      selectedMessageIds.add(article.dataset.messageId);
    } else {
      selectedMessageIds.delete(article.dataset.messageId);
    }
    updateReferenceSelection();
  });

  const initialRefresh = refreshAll();
  document
    .querySelector('[data-action="tool-audit-refresh"]')
    ?.addEventListener("click", refreshToolAudit);
  actionButtons.get("task-refresh")?.addEventListener("click", taskRefreshWindow);
  actionButtons.get("goal-create")?.addEventListener("click", taskCreateGoal);
  actionButtons.get("full-access-enable")?.addEventListener("click", enableFullAccessGrant);
  actionButtons.get("full-access-revoke")?.addEventListener("click", revokeFullAccessGrant);
  actionButtons.get("task-schedule-create")?.addEventListener("click", taskScheduleCreate);
  document.querySelector('[data-role="task-schedule-kind"]')?.addEventListener("change", taskScheduleSyncKindVisibility);
  document.querySelector('[data-role="task-schedule-task-kind"]')?.addEventListener("change", taskScheduleSyncTaskKindVisibility);
  actionButtons.get("task-schedule-run-due")?.addEventListener("click", taskScheduleRunDue);
  actionButtons.get("task-schedule-relay-timeout-save")?.addEventListener("click", saveRelayTimeout);
  document
    .querySelector('[data-role="task-approval-list"]')
    ?.addEventListener("click", approvalHandleTaskListClick);
  document
    .querySelector('[data-role="goal-consult-list"]')
    ?.addEventListener("click", taskHandleGoalListClick);
  document
    .querySelector('[data-role="task-schedule-list"]')
    ?.addEventListener("click", taskScheduleHandleListClick);
  taskInitializeWindow();
  initialRefresh.finally(() => {
    startToolApprovalStream();
    refreshToolAudit();
    taskRefreshWindow();
    startPetDroppedAttachmentsPolling();
  });
});

// 轮询拉取"拖到桌宠的文件"附件，加入 composer（桌宠进程移好文件后入队，前端取出）。
let petDroppedAttachmentsTimer = null;
function startPetDroppedAttachmentsPolling() {
  if (petDroppedAttachmentsTimer) {
    return;
  }
  petDroppedAttachmentsTimer = setInterval(pollPetDroppedAttachments, 3000);
}
async function pollPetDroppedAttachments() {
  let data;
  try {
    data = await requestJson("/api/pet/pending-attachments");
  } catch {
    return; // 服务器忙/未就绪时静默跳过
  }
  const incoming = Array.isArray(data?.attachments) ? data.attachments : [];
  if (!incoming.length) {
    return;
  }
  incoming.forEach((att) => {
    if (!att?.url) {
      return;
    }
    // 已是服务器附件（有 url、无 File 对象）→ 发送时会跳过上传直接用。去重按 url。
    if (pendingFileAttachments.some((a) => a.url === att.url)) {
      return;
    }
    pendingFileAttachments.push({
      id: `pet-drop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: att.kind || "file",
      name: att.name || "拖入文件",
      url: att.url,
      mime_type: att.mime_type || null,
      source: "pet-drop",
    });
  });
  renderComposerAttachments();
  addMessage({
    author: "桌宠",
    text: `已接收 ${incoming.length} 个拖入文件，加入待发送附件。`,
    kind: "thought",
    icon: "robot-message",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  visionWindowInitialize();
  diagnosticsWindowInitialize();
});

function visionWindowInitialize() {
  actionButtons.get("vision-window-refresh")?.addEventListener("click", visionWindowRefreshAll);
  actionButtons.get("vision-realtime-start")?.addEventListener("click", (event) => {
    visionWindowStartRealtime(event.currentTarget);
  });
  actionButtons.get("vision-realtime-stop")?.addEventListener("click", (event) => {
    visionWindowStopRealtime(event.currentTarget);
  });
  actionButtons.get("vision-realtime-dry-run-selected")?.addEventListener("click", (event) => {
    visionWindowRunSelectedRealtimeElementDryRun(event.currentTarget);
  });
  document.querySelector('.vision-workbench-window [data-role="vision-realtime-elements"]')?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-vision-element-index]");
    if (trigger) {
      visionWindowSelectRealtimeElement(Number(trigger.dataset.visionElementIndex));
    }
  });
  document.querySelector('.vision-workbench-window [data-role="vision-window-evidence"]')?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-vision-element-index]");
    if (trigger) {
      visionWindowSelectRealtimeElement(Number(trigger.dataset.visionElementIndex));
    }
  });
  actionButtons.get("vision-describe-dry-run")?.addEventListener("click", (event) => {
    visionWindowRunDryRun(event.currentTarget, "vision.describe_screen");
  });
  actionButtons.get("vision-locate-dry-run")?.addEventListener("click", (event) => {
    visionWindowRunDryRun(event.currentTarget, "vision.find_target");
  });
  actionButtons.get("vision-locate-native")?.addEventListener("click", (event) => {
    visionWindowRunNativeLocate(event.currentTarget);
  });
  actionButtons.get("vision-verify-native")?.addEventListener("click", (event) => {
    visionWindowRunNativeVerify(event.currentTarget);
  });
  groundingRenderSummary({
    backend: "未运行",
    point: "-",
    bbox: "-",
    confidence: "-",
    plan: "等待 describe / locate / closed-loop 结果...",
  });
  visionWindowRefreshAll({ silent: true });
  startVisionRealtimeEventStream();
}

async function visionWindowRefreshAll(options = {}) {
  await Promise.allSettled([
    visionWindowRefreshEvidence(options),
    visionWindowRefreshBackends(options),
  ]);
}

async function visionWindowRefreshEvidence(options = {}) {
  const button = actionButtons.get("vision-window-refresh");
  setBusy(button, true, "刷新中");
  try {
    const state = await requestJson("/api/state");
    setVisionPreview(state.latest_capture);
    const capture = state.latest_capture || {};
    visionWindowSetRoleText(
      "vision-window-evidence-status",
      capture.exists ? `已加载 ${formatFileSize(capture.bytes || 0)}` : "暂无截图",
    );
    if (state.stability?.mode) {
      setText("stability.mode", state.stability.mode);
    }
  } catch (error) {
    visionWindowSetRoleText("vision-window-evidence-status", `刷新失败：${error.message}`);
    if (!options.silent) {
      addMessage({ author: "视觉实验", text: `刷新截图证据失败：${error.message}`, kind: "thought", icon: "error-log" });
    }
  } finally {
    setBusy(button, false);
  }
}

async function visionWindowRefreshBackends(options = {}) {
  try {
    const [backends, capabilities, realtimeStatus, realtimeElements] = await Promise.all([
      requestJson("/api/vision/grounding/backends"),
      requestJson("/api/vision/tool-service/capabilities"),
      requestJson("/api/vision/realtime/status"),
      requestJson("/api/vision/realtime/elements"),
    ]);
    visionWindowRenderBackends(backends);
    visionWindowRenderCapabilities(capabilities);
    visionWindowRenderRealtimeStatus(realtimeStatus);
    visionWindowRenderRealtimeElements(realtimeElements);
  } catch (error) {
    visionWindowSetRoleText("vision-capabilities", `capabilities load failed: ${error.message}`);
    visionWindowSetRoleText("vision-realtime-status", `realtime load failed: ${error.message}`);
    if (!options.silent) {
      addMessage({ author: "视觉实验", text: `视觉后端能力加载失败：${error.message}`, kind: "thought", icon: "error-log" });
    }
  }
}

async function visionWindowStartRealtime(button) {
  setBusy(button, true, "启动中");
  try {
    const response = await requestJson("/api/vision/realtime/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ use_latest_capture: true }),
    });
    visionWindowRenderRealtimeStatus(response);
  } catch (error) {
    visionWindowSetRoleText("vision-realtime-status", `start failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function visionWindowStopRealtime(button) {
  setBusy(button, true, "停止中");
  try {
    const response = await requestJson("/api/vision/realtime/stop", { method: "POST" });
    visionWindowRenderRealtimeStatus(response);
  } catch (error) {
    visionWindowSetRoleText("vision-realtime-status", `stop failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function visionWindowRunDryRun(button, toolId) {
  if (!toolId) {
    return;
  }
  setBusy(button, true, "dry-run");
  groundingRenderSummary({
    backend: toolId,
    point: "-",
    bbox: "-",
    confidence: "-",
    plan: "dry-run 请求已发送，等待后端返回...",
  });
  try {
    const result = await requestJson(`/api/tools/${encodeURIComponent(toolId)}/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: defaultToolDryRunInput(toolId) }),
    });
    groundingRenderToolResult(result);
    await visionWindowRefreshEvidence({ silent: true });
  } catch (error) {
    groundingRenderSummary({
      backend: toolId,
      point: "-",
      bbox: "-",
      confidence: "-",
      plan: `dry-run failed: ${error.message}`,
    });
  } finally {
    setBusy(button, false);
  }
}

async function visionWindowRunNativeLocate(button) {
  const target = visionWindowLocateTarget();
  setBusy(button, true, "locate");
  groundingRenderSummary({
    backend: "grounding router",
    point: "-",
    bbox: "-",
    confidence: "-",
    plan: `locating target: ${target}`,
  });
  try {
    const response = await requestJson("/api/vision/locate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: { kind: "natural", text: target },
        diagnostics: true,
        cross_verify: false,
      }),
    });
    visionLastLocate = response;
    groundingRenderLocateResponse(response);
    await visionWindowRefreshEvidence({ silent: true });
  } catch (error) {
    groundingRenderSummary({
      backend: "grounding router",
      point: "-",
      bbox: "-",
      confidence: "-",
      plan: `native locate failed: ${error.message}`,
    });
  } finally {
    setBusy(button, false);
  }
}

async function visionWindowRunNativeVerify(button) {
  const point = visionLastLocate?.point;
  if (!point) {
    groundingRenderSummary({
      backend: "locate verify",
      point: "-",
      bbox: "-",
      confidence: "-",
      plan: "Run Router locate first; no point is available to verify.",
    });
    return;
  }
  setBusy(button, true, "verify");
  try {
    const response = await requestJson("/api/vision/locate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: visionWindowLocateTarget(),
        point,
      }),
    });
    groundingRenderSummary({
      backend: "locate verify",
      point: groundingFormatPoint(point),
      bbox: groundingFormatBBox(visionLastLocate?.bbox),
      confidence: String(response.confidence ?? "-"),
      plan: `verdict: ${response.verdict || "-"}\nreasoning: ${response.reasoning || "-"}\nelapsed_ms: ${response.elapsed_ms ?? 0}`,
    });
  } catch (error) {
    groundingRenderSummary({
      backend: "locate verify",
      point: groundingFormatPoint(point),
      bbox: "-",
      confidence: "-",
      plan: `verify failed: ${error.message}`,
    });
  } finally {
    setBusy(button, false);
  }
}

function visionWindowLocateTarget() {
  return document.querySelector('[data-role="vision-locate-target"]')?.value?.trim() || "Windows Start button";
}

function visionWindowSetRoleText(role, text) {
  const node = document.querySelector(`.vision-workbench-window [data-role="${role}"]`);
  if (node) {
    node.textContent = text;
  }
}

function visionWindowRenderBackends(response) {
  const host = document.querySelector('.vision-workbench-window [data-role="vision-backends"]');
  if (!host) {
    return;
  }
  host.replaceChildren();
  const backends = Array.isArray(response?.backends) ? response.backends : [];
  if (!backends.length) {
    const empty = document.createElement("li");
    empty.textContent = "No grounding backend reported.";
    host.append(empty);
    return;
  }
  backends.forEach((backend) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${escapeHtml(backend.id || "-")}</strong>
      <span>${escapeHtml(backend.status || (backend.enabled ? "ready" : "disabled"))}</span>
      <small>${escapeHtml(backend.model || backend.version || backend.provider || "")}</small>
    `;
    host.append(item);
  });
}

function visionWindowRenderCapabilities(response) {
  const node = document.querySelector('.vision-workbench-window [data-role="vision-capabilities"]');
  if (!node) {
    return;
  }
  const capabilities = response?.capabilities || response || {};
  node.textContent = groundingCompactJson({
    service: response?.service || response?.name || "vision-tool-service",
    capabilities,
  });
}

function visionWindowRenderRealtimeStatus(response) {
  visionRealtimeLastStatus = { ...visionRealtimeLastStatus, ...response };
  syncVisionRealtimeTask(visionRealtimeLastStatus);
  setWorkbenchMotionState(
    "vision",
    WORKBENCH_MOTION_STATES.vision,
    Boolean(visionRealtimeLastStatus?.loop_running),
  );
  const node = document.querySelector('.vision-workbench-window [data-role="vision-realtime-status"]');
  if (!node) {
    return;
  }
  const status = visionRealtimeLastStatus;
  node.textContent = groundingCompactJson({
    status: status?.status || "-",
    active_loop: status?.active_loop || "-",
    running: Boolean(status?.loop_running),
    frames: status?.frames_processed ?? 0,
    fps: status?.fps ?? "-",
    backend: status?.detection_backend || "-",
    model: status?.detection_model || "-",
    base_url: status?.detection_base_url || "(not configured)",
    elements: status?.element_count ?? 0,
    error: status?.last_error || "",
    resource_switch: status?.resource_switch || {},
  });
}

function visionWindowRenderRealtimeElements(response) {
  const host = document.querySelector('.vision-workbench-window [data-role="vision-realtime-elements"]');
  const elements = Array.isArray(response?.elements) ? response.elements : [];
  visionRealtimeLastElements = elements;
  if (!elements.length) {
    visionRealtimeSelectedElement = null;
    visionRealtimeSelectedElementKey = "";
  } else if (visionRealtimeSelectedElementKey) {
    const stillSelected = elements.find((element, index) =>
      visionWindowRealtimeElementSelectionKey(element, index) === visionRealtimeSelectedElementKey
    );
    if (stillSelected) {
      visionRealtimeSelectedElement = stillSelected;
    } else {
      visionRealtimeSelectedElement = null;
      visionRealtimeSelectedElementKey = "";
    }
  }
  visionWindowRenderRealtimeOverlay(elements);
  if (!host) {
    return;
  }
  host.replaceChildren();
  if (!elements.length) {
    const empty = document.createElement("li");
    empty.textContent = "No realtime element table yet.";
    host.append(empty);
    visionWindowSyncRealtimeSelectedElementUi();
    return;
  }
  elements.slice(0, 12).forEach((element, index) => {
    const item = document.createElement("li");
    const selectionKey = visionWindowRealtimeElementSelectionKey(element, index);
    item.className = selectionKey === visionRealtimeSelectedElementKey ? "is-selected" : "";
    const bbox = element.bbox || {};
    item.innerHTML = `
      <button class="vision-realtime-element-pick" type="button" data-vision-element-index="${index}" data-vision-element-key="${escapeHtml(selectionKey)}">
        <strong>${escapeHtml(element.kind || "unknown")}</strong>
        <span>${escapeHtml(visionWindowRealtimeElementLabel(element))}</span>
        <small>${escapeHtml(`${element.confidence ?? "-"} @ ${bbox.x1 ?? "-"},${bbox.y1 ?? "-"},${bbox.x2 ?? "-"},${bbox.y2 ?? "-"}`)}</small>
      </button>
    `;
    host.append(item);
  });
  visionWindowSyncRealtimeSelectedElementUi();
}

function visionWindowEnsureRealtimeOverlay(host = null) {
  const preview = host || document.querySelector('.vision-workbench-window [data-role="vision-window-evidence"]');
  if (!preview) {
    return document.createElement("div");
  }
  let overlay = preview.querySelector('[data-role="vision-realtime-overlay"]');
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "vision-realtime-overlay";
    overlay.dataset.role = "vision-realtime-overlay";
    overlay.setAttribute("aria-hidden", "true");
    preview.append(overlay);
  }
  return overlay;
}

function visionWindowRenderRealtimeOverlay(elements = []) {
  const overlay = visionWindowEnsureRealtimeOverlay();
  if (!overlay?.isConnected) {
    return;
  }
  overlay.replaceChildren();
  (Array.isArray(elements) ? elements : []).slice(0, 30).forEach((element, index) => {
    const box = visionWindowNormalizedBBox(element?.bbox);
    if (!box) {
      return;
    }
    const selectionKey = visionWindowRealtimeElementSelectionKey(element, index);
    const marker = document.createElement("div");
    marker.className = "vision-realtime-box";
    if (selectionKey === visionRealtimeSelectedElementKey) {
      marker.classList.add("is-selected");
    }
    marker.dataset.visionElementIndex = String(index);
    marker.dataset.visionElementKey = selectionKey;
    marker.dataset.visionElementId = element.id || "";
    marker.style.left = `${box.x1 * 100}%`;
    marker.style.top = `${box.y1 * 100}%`;
    marker.style.width = `${(box.x2 - box.x1) * 100}%`;
    marker.style.height = `${(box.y2 - box.y1) * 100}%`;
    marker.title = [element.text, element.label, element.kind, element.confidence].filter(Boolean).join(" · ");
    const label = document.createElement("span");
    label.textContent = element.text || element.label || element.kind || "element";
    marker.append(label);
    overlay.append(marker);
  });
}

function visionWindowSelectRealtimeElement(index) {
  if (!Number.isInteger(index) || index < 0 || index >= visionRealtimeLastElements.length) {
    return;
  }
  const element = visionRealtimeLastElements[index];
  visionRealtimeSelectedElement = element;
  visionRealtimeSelectedElementKey = visionWindowRealtimeElementSelectionKey(element, index);
  const label = visionWindowRealtimeElementLabel(element);
  const targetInput = document.querySelector('[data-role="vision-locate-target"]');
  if (targetInput && label && label !== "-") {
    targetInput.value = label;
  }
  const box = visionWindowNormalizedBBox(element?.bbox);
  const confidence = element?.confidence ?? element?.score ?? "-";
  groundingRenderSummary({
    backend: "UI-DETR realtime element",
    point: box ? visionWindowFormatNormalizedPoint((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2) : "-",
    bbox: box ? visionWindowFormatNormalizedBBox(box) : "-",
    confidence: String(confidence),
    plan: [
      `selected: ${label}`,
      box ? `bbox(normalized): ${visionWindowFormatNormalizedBBox(box)}` : "bbox: missing",
      "safe action: computer.visual_action dry-run only, execute=false",
    ].join("\n"),
  });
  visionWindowRenderRealtimeOverlay(visionRealtimeLastElements);
  visionWindowSyncRealtimeSelectedElementUi();
}

async function visionWindowRunSelectedRealtimeElementDryRun(button) {
  const element = visionRealtimeSelectedElement;
  const box = visionWindowNormalizedBBox(element?.bbox);
  if (!element || !box) {
    groundingRenderSummary({
      backend: "UI-DETR realtime element",
      point: "-",
      bbox: "-",
      confidence: "-",
      plan: "请先从实时元素列表或截图覆盖框中选择一个带 bbox 的目标。",
    });
    return;
  }
  const label = visionWindowRealtimeElementLabel(element);
  const rawResponse = visionWindowRealtimeElementRawResponse(element, box);
  setBusy(button, true, "dry-run");
  try {
    const result = await requestJson("/api/tools/computer.visual_action/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
          target: label,
          action: "left_click",
          raw_response: JSON.stringify(rawResponse),
          use_latest_capture: true,
          use_model: false,
          execute: false,
        },
      }),
    });
    groundingRenderToolResult(result);
  } catch (error) {
    groundingRenderSummary({
      backend: "UI-DETR realtime element",
      point: "-",
      bbox: visionWindowFormatNormalizedBBox(box),
      confidence: String(element?.confidence ?? element?.score ?? "-"),
      plan: `selected bbox dry-run failed: ${error.message}`,
    });
  } finally {
    setBusy(button, false);
  }
}

function visionWindowSyncRealtimeSelectedElementUi() {
  const node = document.querySelector('.vision-workbench-window [data-role="vision-realtime-selected"]');
  const button = actionButtons.get("vision-realtime-dry-run-selected");
  const hasSelection = Boolean(visionRealtimeSelectedElement && visionWindowNormalizedBBox(visionRealtimeSelectedElement?.bbox));
  if (button) {
    button.disabled = !hasSelection;
  }
  if (node) {
    node.textContent = hasSelection
      ? `已选：${visionWindowRealtimeElementLabel(visionRealtimeSelectedElement)}`
      : "未选择检测框";
  }
  document.querySelectorAll(".vision-realtime-element-pick").forEach((item) => {
    item.classList.toggle("is-selected", item.dataset.visionElementKey === visionRealtimeSelectedElementKey);
  });
}

function visionWindowRealtimeElementSelectionKey(element = {}, index = 0) {
  const bbox = element?.bbox || {};
  return [
    element.id || "",
    element.kind || "",
    element.text || "",
    element.label || "",
    bbox.x1 ?? "",
    bbox.y1 ?? "",
    bbox.x2 ?? "",
    bbox.y2 ?? "",
    index,
  ].join("|");
}

function visionWindowRealtimeElementLabel(element = {}) {
  return element.text || element.label || element.kind || element.id || "selected realtime element";
}

function visionWindowRealtimeElementRawResponse(element, box) {
  return {
    bbox: [box.x1, box.y1, box.x2, box.y2],
    confidence: Number(element?.confidence ?? element?.score ?? 0.5),
    label: element?.label || element?.kind || "element",
    text: element?.text || "",
    id: element?.id || "",
  };
}

function visionWindowFormatNormalizedPoint(x, y) {
  return `(${x.toFixed(3)}, ${y.toFixed(3)})`;
}

function visionWindowFormatNormalizedBBox(box) {
  return `${box.x1.toFixed(3)}, ${box.y1.toFixed(3)}, ${box.x2.toFixed(3)}, ${box.y2.toFixed(3)}`;
}

function visionWindowNormalizedBBox(bbox = {}) {
  const x1 = visionWindowClampUnit(bbox.x1);
  const y1 = visionWindowClampUnit(bbox.y1);
  const x2 = visionWindowClampUnit(bbox.x2);
  const y2 = visionWindowClampUnit(bbox.y2);
  if ([x1, y1, x2, y2].some((value) => value == null)) {
    return null;
  }
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  if (right - left <= 0 || bottom - top <= 0) {
    return null;
  }
  return { x1: left, y1: top, x2: right, y2: bottom };
}

function visionWindowClampUnit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.max(0, Math.min(1, number));
}

function startVisionRealtimeEventStream() {
  if (!window.EventSource || visionRealtimeEventSource) {
    return;
  }
  const source = new EventSource("/api/vision/realtime/events");
  visionRealtimeEventSource = source;
  source.addEventListener("element-table-updated", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      visionWindowRenderRealtimeStatus({
        status: payload.status || "updated",
        active_loop: payload.active_loop || "element_table_ready",
        fps: payload.fps ?? "-",
        detection_backend: payload.backend,
        detection_model: payload.model,
        element_count: payload.element_count,
        resource_switch: payload.resource_switch || {},
      });
      visionWindowRenderRealtimeElements({ elements: payload.elements || [] });
    } catch (error) {
      visionWindowSetRoleText("vision-realtime-status", `event parse failed: ${error.message}`);
    }
  });
  source.onerror = () => {
    try {
      source.close();
    } catch {
      // ignore close failures
    }
    visionRealtimeEventSource = null;
    window.setTimeout(startVisionRealtimeEventStream, 2500);
  };
}

function startRealtimeSessionEventStream() {
  if (!window.EventSource || realtimeSessionEventSource) {
    return;
  }
  const source = new EventSource("/api/realtime/session/events");
  realtimeSessionEventSource = source;
  [
    "session_started",
    "session_stopped",
    "audio_segment",
    "partial_transcript",
    "final_transcript",
    "vision_frame",
    "assistant_started",
    "assistant_text",
    "assistant_done",
    "action_step",
    "barge_in_decision",
    "tts_synthesis_started",
    "tts_synthesis_ready",
    "tts_synthesis_error",
    "tts_chunk",
    "tts_stream_chunk",
    "tts_audio_chunk",
    "tts_playback_started",
    "tts_playback_segment",
    "tts_playback_ended",
    "tts_playback_stopped",
  ].forEach((kind) => {
    source.addEventListener(kind, (event) => {
      handleRealtimeSessionEvent(kind, event);
    });
  });
  source.addEventListener("lagged", () => {
    scheduleRealtimeSessionEventRefresh();
  });
  source.onerror = () => {
    try {
      source.close();
    } catch {
      // ignore close failures
    }
    realtimeSessionEventSource = null;
    window.setTimeout(startRealtimeSessionEventStream, 2500);
  };
}

function handleRealtimeSessionEvent(kind, event) {
  const envelope = safeJsonParse(event.data || "{}") || {};
  const isLocalEvent = envelope.local === true;
  const payload = envelope.payload || {};
  realtimeSessionLastEvents.push({
    kind,
    at_ms: envelope.at_ms || Date.now(),
    session_id: envelope.session_id || null,
    payload,
  });
  while (realtimeSessionLastEvents.length > 80) {
    realtimeSessionLastEvents.shift();
  }
  if (!realtimeSessionStatus) {
    realtimeSessionStatus = {};
  }
  if (kind === "session_started") {
    realtimeSessionRunning = true;
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      running: true,
      requested_mode: payload.requested_mode || realtimeSessionStatus.requested_mode,
      active_mode: payload.active_mode || realtimeSessionStatus.active_mode,
      main_state: "listening",
    };
  } else if (kind === "session_stopped") {
    realtimeSessionRunning = false;
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      running: false,
      main_state: "idle",
      audio_in_state: "off",
      vision_state: "off",
      audio_out_state: "idle",
    };
  } else if (kind === "audio_segment") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_segments_received: payload.audio_segments_received ?? realtimeSessionStatus.audio_segments_received,
      audio_bytes_received: payload.audio_bytes_received ?? realtimeSessionStatus.audio_bytes_received,
      audio_payload_chunks_received: payload.audio_payload_chunks_received ?? realtimeSessionStatus.audio_payload_chunks_received,
      active_stt_transport: payload.active_stt_transport || realtimeSessionStatus.active_stt_transport,
    };
  } else if (kind === "partial_transcript" || kind === "final_transcript") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      last_partial_text: payload.text || realtimeSessionStatus.last_partial_text,
      last_partial_confidence: payload.confidence ?? realtimeSessionStatus.last_partial_confidence,
      last_partial_is_final: kind === "final_transcript",
      partial_asr_provider: payload.provider || realtimeSessionStatus.partial_asr_provider,
      barge_in_state: payload.barge_in_state || realtimeSessionStatus.barge_in_state,
      audio_out_state: payload.should_interrupt ? "cancelled" : realtimeSessionStatus.audio_out_state,
    };
  } else if (kind === "vision_frame") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      vision_state: payload.status || realtimeSessionStatus.vision_state,
      vision_element_count: payload.element_count ?? realtimeSessionStatus.vision_element_count,
      detection_backend: payload.backend || realtimeSessionStatus.detection_backend,
      detection_model: payload.model || realtimeSessionStatus.detection_model,
    };
  } else if (kind === "assistant_started") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      main_state: "reasoning",
      reasoning_state: "thinking",
      last_assistant_agent: payload.agent_name || payload.agent_id || realtimeSessionStatus.last_assistant_agent,
      last_assistant_message_id: payload.message_id || realtimeSessionStatus.last_assistant_message_id,
      last_assistant_text: "",
    };
  } else if (kind === "assistant_text") {
    const existingText = realtimeSessionStatus.last_assistant_message_id === payload.message_id
      ? String(realtimeSessionStatus.last_assistant_text || "")
      : "";
    const nextText = `${existingText}${payload.delta || ""}`;
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      main_state: "responding",
      reasoning_state: "responding",
      last_assistant_agent: payload.agent_name || payload.agent_id || realtimeSessionStatus.last_assistant_agent,
      last_assistant_message_id: payload.message_id || realtimeSessionStatus.last_assistant_message_id,
      last_assistant_text: nextText.slice(-1200),
    };
  } else if (kind === "assistant_done") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      main_state: "assistant_done",
      reasoning_state: "idle",
      last_assistant_agent: payload.agent_name || payload.agent_id || realtimeSessionStatus.last_assistant_agent,
      last_assistant_message_id: payload.message_id || realtimeSessionStatus.last_assistant_message_id,
      last_assistant_text: payload.content || realtimeSessionStatus.last_assistant_text || "",
    };
  } else if (kind === "action_step") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      main_state: "acting",
      reasoning_state: "tool_calling",
      last_action_status: payload.status || realtimeSessionStatus.last_action_status,
      last_action_tool: payload.tool_name || realtimeSessionStatus.last_action_tool,
      last_action_summary: payload.summary || realtimeSessionStatus.last_action_summary,
    };
  } else if (kind === "barge_in_decision") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      barge_in_state: payload.barge_in_state || realtimeSessionStatus.barge_in_state,
      audio_out_state: payload.should_interrupt ? "cancelled" : realtimeSessionStatus.audio_out_state,
      last_barge_in_decision: payload.decision || realtimeSessionStatus.last_barge_in_decision,
      last_barge_in_reason: payload.reason || realtimeSessionStatus.last_barge_in_reason,
    };
    handleRealtimeBargeInDecision({
      decision: payload.decision,
      barge_in_state: payload.barge_in_state,
      should_interrupt: Boolean(payload.should_interrupt),
      reason: payload.reason,
      recommended_action: payload.recommended_action,
    });
  } else if (kind === "tts_synthesis_started") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: "synthesizing",
      last_tts_source: payload.source || realtimeSessionStatus.last_tts_source,
      last_tts_backend: payload.backend || realtimeSessionStatus.last_tts_backend,
      last_tts_segment_count: payload.segment_count ?? realtimeSessionStatus.last_tts_segment_count,
    };
  } else if (kind === "tts_synthesis_ready") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: "ready",
      last_tts_source: payload.source || realtimeSessionStatus.last_tts_source,
      last_tts_backend: payload.backend || realtimeSessionStatus.last_tts_backend,
      last_tts_segment_count: payload.segment_count ?? realtimeSessionStatus.last_tts_segment_count,
      last_tts_duration_ms: payload.duration_ms ?? realtimeSessionStatus.last_tts_duration_ms,
    };
  } else if (kind === "tts_synthesis_error") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: "error",
      last_error: payload.error || realtimeSessionStatus.last_error,
    };
  } else if (kind === "tts_chunk" || kind === "tts_stream_chunk" || kind === "tts_audio_chunk") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: "speaking",
      tts_transport: "chunked_tts_stream",
      last_tts_source: payload.source || realtimeSessionStatus.last_tts_source,
      last_tts_played: payload.index ?? payload.chunk_index ?? realtimeSessionStatus.last_tts_played,
      last_tts_segment_count: payload.total ?? payload.chunk_count ?? realtimeSessionStatus.last_tts_segment_count,
    };
    enqueueRealtimeTtsChunk(payload);
  } else if (kind === "tts_playback_started" || kind === "tts_playback_segment") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: "speaking",
      last_tts_source: payload.source || realtimeSessionStatus.last_tts_source,
      last_tts_played: payload.index ?? realtimeSessionStatus.last_tts_played,
      last_tts_segment_count: payload.total ?? payload.segment_count ?? realtimeSessionStatus.last_tts_segment_count,
    };
  } else if (kind === "tts_playback_ended" || kind === "tts_playback_stopped") {
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_out_state: kind === "tts_playback_stopped" ? "stopped" : "idle",
      last_tts_source: payload.source || realtimeSessionStatus.last_tts_source,
      last_tts_played: payload.played ?? realtimeSessionStatus.last_tts_played,
      last_tts_segment_count: payload.total ?? payload.segment_count ?? realtimeSessionStatus.last_tts_segment_count,
    };
  }
  renderRealtimeSessionStatus(realtimeSessionStatus);
  syncRealtimeSessionTask(realtimeSessionStatus);
  if (!isLocalEvent) {
    scheduleRealtimeSessionEventRefresh();
  }
}

function emitLocalRealtimeSessionEvent(kind, payload = {}) {
  handleRealtimeSessionEvent(kind, {
    data: JSON.stringify({
      kind,
      local: true,
      at_ms: Date.now(),
      session_id: realtimeSessionStatus?.session_id || null,
      payload,
    }),
  });
}

function scheduleRealtimeSessionEventRefresh() {
  if (realtimeSessionEventRefreshTimer) {
    return;
  }
  realtimeSessionEventRefreshTimer = window.setTimeout(async () => {
    realtimeSessionEventRefreshTimer = null;
    await refreshRealtimeSessionStatus();
  }, 350);
}

function groundingRenderLocateResponse(response) {
  const attempts = Array.isArray(response?.attempts) ? response.attempts : [];
  const attemptLines = attempts.map((attempt) => {
    const point = attempt.point ? groundingFormatPoint(attempt.point) : "-";
    const conf = attempt.confidence == null ? "-" : attempt.confidence;
    return `${attempt.backend || "-"} ${attempt.status || "-"} point=${point} confidence=${conf}${attempt.error ? ` error=${attempt.error}` : ""}`;
  });
  const planLines = [
    `status: ${response?.status || "-"}`,
    `target: ${response?.target_description || "-"}`,
    `chosen_backend: ${response?.chosen_backend || "-"}`,
    `capture: ${response?.capture_path || "-"}`,
    response?.degradation_reason ? `degradation: ${response.degradation_reason}` : "",
    ...attemptLines,
    ...(response?.notes || []),
  ].filter(Boolean);
  groundingRenderSummary({
    backend: response?.chosen_backend || response?.status || "grounding router",
    point: groundingFormatPoint(response?.point),
    bbox: groundingFormatBBox(response?.bbox),
    confidence: response?.confidence == null ? "-" : String(response.confidence),
    plan: planLines.join("\n") || groundingCompactJson(response),
  });
}

function groundingRenderToolResult(result) {
  const output = result?.output || {};
  const grounding = output.grounding || output.locate?.grounding || {};
  const actionPlan = output.action_plan || output.dispatch_plan?.action_plan || {};
  const point = grounding.point || output.point || output.locate?.point || actionPlan.point;
  const bbox = grounding.bbox || output.bbox || output.locate?.bbox || actionPlan.roi;
  const confidence = grounding.confidence ?? output.confidence ?? output.locate?.confidence ?? "-";
  const backend =
    output.chosen_backend ||
    output.source ||
    output.backend?.name ||
    output.backend?.id ||
    output.backend?.provider ||
    result?.tool_id ||
    "dry-run";
  const planLines = [
    summarizeToolDryRun(result),
    output.status ? `status: ${output.status}` : "",
    output.description ? `description: ${output.description}` : "",
    output.target ? `target: ${output.target}` : "",
    output.notes?.length ? `notes: ${output.notes.join(" / ")}` : "",
  ].filter(Boolean);
  groundingRenderSummary({
    backend,
    point: groundingFormatPoint(point),
    bbox: groundingFormatBBox(bbox),
    confidence: confidence === "-" ? "-" : String(confidence),
    plan: planLines.join("\n") || groundingCompactJson(output),
  });
}

function groundingRenderSummary(summary) {
  visionWindowSetRoleText("grounding-backend", summary.backend || "-");
  visionWindowSetRoleText("grounding-point", summary.point || "-");
  visionWindowSetRoleText("grounding-bbox", summary.bbox || "-");
  visionWindowSetRoleText("grounding-confidence", summary.confidence || "-");
  visionWindowSetRoleText("grounding-plan", summary.plan || "-");
}

function groundingFormatPoint(point) {
  if (!point) {
    return "-";
  }
  const x = point.x ?? point.left ?? point[0];
  const y = point.y ?? point.top ?? point[1];
  if (x == null || y == null) {
    return "-";
  }
  return `(${x}, ${y})`;
}

function groundingFormatBBox(bbox) {
  if (!bbox) {
    return "-";
  }
  const x = bbox.x ?? bbox.left ?? bbox[0];
  const y = bbox.y ?? bbox.top ?? bbox[1];
  const width = bbox.width ?? bbox.w ?? bbox[2];
  const height = bbox.height ?? bbox.h ?? bbox[3];
  if ([x, y, width, height].some((value) => value == null)) {
    return "-";
  }
  return `${x}, ${y}, ${width}x${height}`;
}

function groundingCompactJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2).slice(0, 1200);
  } catch {
    return String(value || "");
  }
}

function diagnosticsWindowInitialize() {
  actionButtons.get("diagnostics-window-refresh")?.addEventListener("click", diagnosticsWindowRefresh);
  diagnosticsWindowRefresh({ silent: true });
}

function diagnosticsSelfcheckHost() {
  return document.querySelector('[data-role="module-selfcheck"]');
}

async function diagnosticsWindowRefresh(options = {}) {
  const button = actionButtons.get("diagnostics-window-refresh");
  setBusy(button, true, "检查中");
  try {
    const data = await requestJson(`/api/diagnostics/${"health"}`);
    diagnosticsWindowRenderHealth(data);
  } catch (error) {
    diagnosticsWindowRenderHealthError(error);
    if (!options.silent) {
      addMessage({ author: "模块自检", text: `健康检查失败：${error.message}`, kind: "thought", icon: "error-log" });
    }
  } finally {
    setBusy(button, false);
  }
}

function diagnosticsWindowRenderHealth(data) {
  const summary = data?.summary || {};
  const status = summary.status || "unknown";
  const card = diagnosticsSelfcheckHost()?.querySelector(".logs-window-health-card");
  if (card) {
    card.classList.remove("is-ok", "is-warn", "is-error", "is-unknown");
    card.classList.add(`is-${status}`);
  }
  diagnosticsWindowSetRoleText("logs-window-health-status", status.toUpperCase());
  diagnosticsWindowSetRoleText(
    "logs-window-health-counts",
    `ok ${summary.ok ?? 0} / warn ${summary.warn ?? 0} / error ${summary.error ?? 0}`,
  );
  diagnosticsWindowRenderChecks(data?.checks || []);
  diagnosticsWindowRenderSuggestions(data?.suggestions || []);
  pulseWorkbenchMotionState("tasks", WORKBENCH_MOTION_STATES.tasks, 920);
}

function diagnosticsWindowRenderHealthError(error) {
  const card = diagnosticsSelfcheckHost()?.querySelector(".logs-window-health-card");
  if (card) {
    card.classList.remove("is-ok", "is-warn", "is-unknown");
    card.classList.add("is-error");
  }
  diagnosticsWindowSetRoleText("logs-window-health-status", "ERROR");
  diagnosticsWindowSetRoleText("logs-window-health-counts", error.message || "health failed");
  diagnosticsWindowRenderChecks([]);
  diagnosticsWindowRenderSuggestions([{ priority: "high", message: error.message || "health endpoint unavailable" }]);
  pulseWorkbenchMotionState("tasks", WORKBENCH_MOTION_STATES.tasks, 920);
}

function diagnosticsWindowRenderChecks(checks) {
  const host = diagnosticsSelfcheckHost()?.querySelector('[data-role="logs-window-checks"]');
  if (!host) {
    return;
  }
  host.replaceChildren();
  const list = document.createElement("ul");
  list.className = "logs-window-list";
  (checks || []).slice(0, 10).forEach((check) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.className = `status-${check.status || "unknown"}`;
    title.textContent = `${check.label || check.id || "check"} · ${check.status || "unknown"}`;
    const detail = document.createElement("small");
    detail.textContent = check.detail || "";
    item.append(title, detail);
    list.append(item);
  });
  if (!list.children.length) {
    const empty = document.createElement("p");
    empty.textContent = "暂无 health check 数据。";
    host.append(empty);
    return;
  }
  host.append(list);
}

function diagnosticsWindowRenderSuggestions(suggestions) {
  const host = diagnosticsSelfcheckHost()?.querySelector('[data-role="logs-window-suggestions"]');
  diagnosticsWindowSetRoleText("logs-window-suggestion-count", String((suggestions || []).length));
  if (!host) {
    return;
  }
  host.replaceChildren();
  const list = document.createElement("ul");
  list.className = "logs-window-list";
  (suggestions || []).slice(0, 8).forEach((suggestion) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = suggestion.priority || "medium";
    const detail = document.createElement("small");
    detail.textContent = suggestion.message || suggestion.check_id || "";
    item.append(title, detail);
    list.append(item);
  });
  if (!list.children.length) {
    const empty = document.createElement("p");
    empty.textContent = "暂无修复建议。";
    host.append(empty);
    return;
  }
  host.append(list);
}

function diagnosticsWindowSetRoleText(role, text) {
  const node = document.querySelector(`[data-role="${role}"]`);
  if (node) {
    node.textContent = text;
  }
}

async function refreshSelfUpdatePlan() {
  const button = actionButtons.get("self-update-plan-refresh");
  setBusy(button, true, "Loading");
  try {
    const plan = await requestJson("/api/system/self-update-plan");
    const status = document.querySelector('[data-role="self-update-status"]');
    const target = document.querySelector('[data-role="self-update-plan-summary"]');
    if (status) {
      status.textContent = plan.rollback_enabled ? "rollback ready" : "rollback disabled";
    }
    if (target) {
      target.textContent = [
        `current: ${plan.current_slot}`,
        `previous: ${plan.previous_slot}`,
        `staging: ${plan.staging_dir}`,
        "",
        "steps:",
        ...(plan.steps || []).map((step, index) => `${index + 1}. ${step}`),
        "",
        "rollback guards:",
        ...(plan.rollback_guards || []).map((guard, index) => `${index + 1}. ${guard}`),
      ].join("\n");
    }
  } catch (error) {
    const target = document.querySelector('[data-role="self-update-plan-summary"]');
    if (target) {
      target.textContent = `Self update plan failed: ${error.message}`;
    }
  } finally {
    setBusy(button, false);
  }
}

// round3-v2 授权窗：模块自检行图标按真实健康状态切换（error/warn→alert-triangle，packaging→package-crate）。
function moduleSelfcheckRowIcon(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "ok" || normalized === "ready" || normalized === "pass" || normalized === "passed" || normalized === "active") {
    return "./assets/icons-wuxia/shield.svg";
  }
  if (normalized === "packaging" || normalized === "package") {
    return "./assets/icons-wuxia/package-crate.svg";
  }
  return "./assets/icons-wuxia/alert-triangle.svg";
}

// round3-v2 授权窗：同步"对哪个会话授权 + 生效范围 + 风险提示"到授权配置列。
function refreshAuthorizationSelectedRoom() {
  const roomEl = document.querySelector('[data-role="authorization-selected-room"]');
  const scopeEl = document.querySelector('[data-role="authorization-scope"]');
  const riskEl = document.querySelector('[data-role="authorization-risk"]');
  const room = chatRoomRegistry.rooms?.find((item) => item.id === activeChatRoomId);
  const workspace = room?.name || "";
  const fullAccess = (document.querySelector('[data-bind="tasks.fullAccessStatus"]')?.textContent || "").trim();
  const fullOn = /开启|启用|active|granted|enabled/i.test(fullAccess) || /(^|[^a-z])on([^a-z]|$)/i.test(fullAccess);
  if (roomEl) {
    roomEl.textContent = workspace && workspace !== "—" ? workspace : "未选择会话";
  }
  if (scopeEl) {
    scopeEl.textContent = fullOn ? "Full access（全量授权）" : "workspace 默认放行";
  }
  if (riskEl) {
    riskEl.textContent = fullOn
      ? "当前 Full access 生效：会话可执行任意命令与文件写入，进程重启或到期后失效。"
      : "授权前确认风险：Full access 允许会话执行任意命令与文件写入，进程重启或到期后失效。";
  }
}

// round3-v2 授权窗：9 行模块自检从真实健康检查端点映射状态与图标。
const MODULE_SELFCHECK_HEALTH_KEYS = {
  "web-console": ["web.state", "web.bind"],
  "desktop-pet": ["desktop.pet"],
  "local-model": ["llm.providers", "llm.local", "local-model"],
  "vision": ["vision.capture", "vision"],
  "tts-stt": ["audio.voice_monitor", "audio"],
  "mcp": ["mcp"],
  "plugin": ["plugin", "tools.catalog"],
  "packaging": ["packaging", "package"],
  "logs": ["logs", "config.coolzhu_toml"],
};

async function refreshModuleSelfcheckRows() {
  let checks = [];
  try {
    const data = await requestJson(`/api/diagnostics/${"health"}`);
    checks = Array.isArray(data?.checks) ? data.checks : [];
  } catch (error) {
    console.warn("module selfcheck health failed", error);
  }
  document.querySelectorAll("[data-selfcheck-module]").forEach((row) => {
    const moduleKey = row.getAttribute("data-selfcheck-module");
    const keys = MODULE_SELFCHECK_HEALTH_KEYS[moduleKey] || [moduleKey];
    const match = checks.find((check) => keys.some((key) => String(check.id || "").includes(key)));
    const status = match ? match.status : (moduleKey === "packaging" ? "packaging" : "unknown");
    const icon = row.querySelector(".module-selfcheck-icon");
    if (icon) icon.src = moduleSelfcheckRowIcon(status);
    row.classList.toggle("is-error", status === "error");
    row.classList.toggle("is-warn", status === "warn" || status === "warning");
    const statusEl = row.querySelector('[data-selfcheck-field="status"]');
    if (statusEl) statusEl.textContent = match ? (match.status || "—") : "—";
    const detailEl = row.querySelector('[data-selfcheck-field="detail"]');
    if (detailEl) detailEl.textContent = match ? (match.detail || "") : "未接入健康检查";
    const timeEl = row.querySelector('[data-selfcheck-field="time"]');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
  });
}

async function refreshAllStep(label, operation) {
  try {
    await operation();
  } catch (error) {
    console.warn(`refresh step failed: ${label}`, error);
  }
}

async function refreshAll() {
  const steps = [
    ["avatars", loadAvatarManifest],
    ["state", refreshState],
    ["showui service", refreshShowUiServiceStatus],
    ["agents", loadAgents],
    ["sessions", loadSessions],
    ["goal roles", loadGoalRoles],
    ["chat rooms", loadChatRooms],
    ["clawbot", () => refreshClawbotWindow({ silent: true })],
    ["task schedules", refreshTaskSchedules],
    ["realtime session", refreshRealtimeSessionStatus],
    ["browser proxy", browserProxyLoad],
    ["self update", refreshSelfUpdatePlan],
    ["module selfcheck", refreshModuleSelfcheckRows],
    ["authorization room", refreshAuthorizationSelectedRoom],
    ["project tree", loadProjectTree],
    ["memory", memoryWindowRefresh],
    ["tools", loadToolsCatalog],
    ["office scene", () => loadOfficeScene({ silent: true })],
  ];
  for (const [label, operation] of steps) {
    await refreshAllStep(label, operation);
  }
}

function clawbotRole(role) {
  return document.querySelector(`.clawbot-workbench-window [data-role="${role}"]`);
}

function setClawbotText(role, value) {
  const node = clawbotRole(role);
  if (node) {
    node.textContent = value == null || value === "" ? "—" : String(value);
  }
}

function setClawbotOutput(role, value) {
  const node = clawbotRole(role);
  if (!node) {
    return;
  }
  node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function clawbotInputValue(role) {
  return clawbotRole(role)?.value?.trim() || "";
}

function setClawbotInputValue(role, value) {
  const node = clawbotRole(role);
  if (node) {
    node.value = value || "";
  }
}

function setClawbotChecked(role, checked) {
  const node = clawbotRole(role);
  if (node) {
    node.checked = Boolean(checked);
  }
}

function clawbotTargetsFromText(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function clawbotStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "ready") return "Ready";
  if (normalized === "disabled") return "Disabled";
  return status || "Unknown";
}

function clawbotLoginLabel(state) {
  const labels = {
    logged_out: "Logged out",
    refresh_requested: "Requesting QR",
    awaiting_scan: "Awaiting scan",
    online: "Online",
    expired: "QR expired",
    error: "Error",
  };
  return labels[String(state || "").toLowerCase()] || "Unknown";
}

function isClawbotQrLink(value) {
  return typeof value === "string"
    && /^https:\/\/liteapp\.weixin\.qq\.com\/q\//.test(value);
}

function clawbotQrUtf8Bytes(value) {
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(String(value || "")));
  }
  return Array.from(unescape(encodeURIComponent(String(value || ""))), (ch) => ch.charCodeAt(0));
}

function clawbotQrAppendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function clawbotQrGfMul(left, right) {
  let product = 0;
  let a = left;
  let b = right;
  while (b > 0) {
    if ((b & 1) !== 0) {
      product ^= a;
    }
    a <<= 1;
    if ((a & 0x100) !== 0) {
      a ^= 0x11d;
    }
    b >>>= 1;
  }
  return product & 0xff;
}

function clawbotQrReedSolomonDivisor(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = clawbotQrGfMul(result[j], root);
      if (j + 1 < result.length) {
        result[j] ^= result[j + 1];
      }
    }
    root = clawbotQrGfMul(root, 0x02);
  }
  return result;
}

function clawbotQrReedSolomonRemainder(data, degree) {
  const divisor = clawbotQrReedSolomonDivisor(degree);
  const result = Array(degree).fill(0);
  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= clawbotQrGfMul(divisor[i], factor);
    }
  }
  return result;
}

function clawbotQrFormatBits(mask) {
  const errorCorrectionLevelLow = 1;
  const data = (errorCorrectionLevelLow << 3) | (mask & 7);
  let remainder = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((remainder >>> i) & 1) !== 0) {
      remainder ^= 0x537 << (i - 10);
    }
  }
  return (((data << 10) | (remainder & 0x3ff)) ^ 0x5412) & 0x7fff;
}

function clawbotLiteappQrDataUrl(value) {
  if (!isClawbotQrLink(value)) {
    return "";
  }
  const version = 5;
  const size = 17 + version * 4;
  const dataCodewords = 108;
  const eccCodewords = 26;
  const maxByteLength = 106;
  const mask = 0;
  const bytes = clawbotQrUtf8Bytes(value);
  if (bytes.length > maxByteLength) {
    return "";
  }

  const bits = [];
  clawbotQrAppendBits(bits, 0x4, 4);
  clawbotQrAppendBits(bits, bytes.length, 8);
  for (const byte of bytes) {
    clawbotQrAppendBits(bits, byte, 8);
  }
  const capacityBits = dataCodewords * 8;
  clawbotQrAppendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | bits[i + j];
    }
    data.push(byte);
  }
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xfd) {
    data.push(pad);
  }
  const codewords = data.concat(clawbotQrReedSolomonRemainder(data, eccCodewords));
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const functionModules = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunctionModule = (row, col, dark) => {
    if (row < 0 || row >= size || col < 0 || col >= size) {
      return;
    }
    modules[row][col] = Boolean(dark);
    functionModules[row][col] = true;
  };
  const drawFinder = (row, col) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const yy = row + y;
        const xx = col + x;
        const inFinder = y >= 0 && y <= 6 && x >= 0 && x <= 6;
        const border = y === 0 || y === 6 || x === 0 || x === 6;
        const center = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        setFunctionModule(yy, xx, inFinder && (border || center));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }
  const alignmentCenter = 30;
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      setFunctionModule(
        alignmentCenter + y,
        alignmentCenter + x,
        Math.max(Math.abs(x), Math.abs(y)) !== 1,
      );
    }
  }
  const drawFormatBits = () => {
    const format = clawbotQrFormatBits(mask);
    const bit = (index) => ((format >>> index) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) {
      setFunctionModule(i, 8, bit(i));
    }
    setFunctionModule(7, 8, bit(6));
    setFunctionModule(8, 8, bit(7));
    setFunctionModule(8, 7, bit(8));
    for (let i = 9; i < 15; i += 1) {
      setFunctionModule(8, 14 - i, bit(i));
    }
    for (let i = 0; i < 8; i += 1) {
      setFunctionModule(8, size - 1 - i, bit(i));
    }
    for (let i = 8; i < 15; i += 1) {
      setFunctionModule(size - 15 + i, 8, bit(i));
    }
    setFunctionModule(size - 8, 8, true);
  };
  drawFormatBits();

  const codewordBits = [];
  for (const byte of codewords) {
    clawbotQrAppendBits(codewordBits, byte, 8);
  }
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }
    for (let vert = 0; vert < size; vert += 1) {
      const row = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        if (!functionModules[row][col]) {
          modules[row][col] = bitIndex < codewordBits.length && codewordBits[bitIndex] === 1;
          bitIndex += 1;
        }
      }
    }
    upward = !upward;
  }
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!functionModules[row][col] && (row + col) % 2 === 0) {
        modules[row][col] = !modules[row][col];
      }
    }
  }
  drawFormatBits();

  const quietZone = 4;
  const viewSize = size + quietZone * 2;
  const rects = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules[row][col]) {
        rects.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join("")}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseClawbotCommandText(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const name = match?.[1] || "";
  const rest = (match?.[2] || "").trim();
  switch (name) {
    case "/room":
      return rest ? { type: "select_room", room: rest } : null;
    case "/use":
      return rest ? { type: "use_session_or_model", selector: rest } : null;
    case "/target": {
      const target_agent_ids = clawbotTargetsFromText(rest);
      return target_agent_ids.length ? { type: "select_targets", target_agent_ids } : null;
    }
    case "/continue":
      return rest ? { type: "continue_task", task_id: rest } : null;
    case "/rooms":
      return { type: "list_rooms" };
    case "/sessions":
      return { type: "list_sessions" };
    case "/tasks":
      return { type: "list_tasks" };
    case "/status":
      return { type: "status" };
    case "/new":
      return rest ? { type: "use_session_or_model", selector: rest } : null;
    case "/help":
      return { type: "help" };
    default:
      return null;
  }
}

async function refreshClawbotWindow({ silent = false } = {}) {
  if (!document.querySelector(".clawbot-workbench-window")) {
    return;
  }
  try {
    const [status, commands, bindings, gatewayLogin, gatewayMetrics, sidecarHealth, sessions, rooms] = await Promise.all([
      requestJson("/api/channels/clawbot/status"),
      requestJson("/api/channels/clawbot/commands"),
      requestJson("/api/channels/clawbot/bindings"),
      requestJson("/api/channels/clawbot/gateway/login"),
      requestJson("/api/channels/clawbot/gateway/metrics"),
      requestJson("/api/channels/clawbot/sidecar/health"),
      requestJson("/api/sessions"),
      requestJson("/api/chat/rooms"),
    ]);
    let contacts = [];
    let administrator = null;
    const accountId = String(gatewayLogin?.account_id || "").trim();
    const loginOnline = String(gatewayLogin?.state || "").toLowerCase() === "online";
    if (loginOnline && accountId) {
      const accountQuery = encodeURIComponent(accountId);
      [contacts, administrator] = await Promise.all([
        requestJson(`/api/channels/clawbot/contacts?account_id=${accountQuery}`),
        requestJson(`/api/channels/clawbot/administrator?account_id=${accountQuery}`),
      ]);
      contacts = Array.isArray(contacts) ? contacts : [];
    }
    clawbotChannel = {
      ...clawbotChannel,
      status,
      commands: Array.isArray(commands) ? commands : (Array.isArray(status?.commands) ? status.commands : []),
      bindings: Array.isArray(bindings) ? bindings : [],
      gatewayLogin,
      gatewayMetrics,
      sidecarHealth,
      sessionRegistry: sessions,
      roomRegistry: rooms,
      contacts,
      administrator,
    };
    renderClawbotWindow();
    if (clawbotLoginNeedsPolling(gatewayLogin?.state)) {
      startClawbotLoginPolling();
    } else {
      stopClawbotLoginPolling();
    }
  } catch (error) {
    console.warn("clawbot refresh failed", error);
    if (!silent) {
      setClawbotOutput("clawbot-preview-output", `微信连接状态加载失败：${error.message}`);
    }
  }
}

function renderClawbotWindow() {
  const status = clawbotChannel.status || {};
  const bindingsList = Array.isArray(clawbotChannel.bindings) ? clawbotChannel.bindings : [];
  const commands = Array.isArray(clawbotChannel.commands) ? clawbotChannel.commands : [];
  const statusLabel = clawbotStatusLabel(status.status);
  setClawbotText("clawbot-status", statusLabel);
  setClawbotText("clawbot-binding-count", String(bindingsList.length));
  setClawbotText("clawbot-capabilities", (status.capabilities || []).join(", ") || "text");
  const statusCard = document.querySelector(".clawbot-status-card");
  statusCard?.classList.toggle("is-ready", String(status.status || "").toLowerCase() === "ready");
  statusCard?.classList.toggle("is-disabled", String(status.status || "").toLowerCase() === "disabled");
  renderClawbotGatewayState();
  renderClawbotSidecarState();
  renderClawbotCommands(commands);
  renderClawbotRouteOptions();
  renderClawbotAdministrator();
  renderClawbotBindings(bindingsList);
}

function clawbotLoggedInAccountId() {
  const login = clawbotChannel.gatewayLogin || {};
  return String(login.state || "").toLowerCase() === "online"
    ? String(login.account_id || "").trim()
    : "";
}

function renderClawbotAdministrator() {
  const select = clawbotRole("clawbot-administrator-select");
  const administrator = clawbotChannel.administrator;
  const contacts = Array.isArray(clawbotChannel.contacts) ? clawbotChannel.contacts : [];
  if (select) {
    const previous = select.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = contacts.length ? "请选择已识别私聊联系人" : "请先与机器人私聊一次";
    select.replaceChildren(placeholder);
    contacts.forEach((contact) => {
      const option = document.createElement("option");
      option.value = contact.peer_id || "";
      option.textContent = `${contact.peer_name || "未命名联系人"} · ${contact.peer_id || "—"}`;
      select.append(option);
    });
    const preferred = administrator?.peer_id || previous;
    if (contacts.some((contact) => contact.peer_id === preferred)) {
      select.value = preferred;
    }
    select.disabled = !clawbotLoggedInAccountId() || !contacts.length;
  }
  setClawbotText(
    "clawbot-administrator-status",
    administrator
      ? `已认领：${administrator.peer_name || administrator.peer_id}`
      : (clawbotLoggedInAccountId() ? "尚未认领" : "登录后可认领"),
  );
  const claimButton = actionButtons.get("clawbot-administrator-claim");
  const clearButton = actionButtons.get("clawbot-administrator-clear");
  if (claimButton) {
    claimButton.disabled = !clawbotLoggedInAccountId() || !contacts.length;
    claimButton.textContent = administrator ? "更换 / 更新管理员" : "认领操作管理员";
  }
  if (clearButton) {
    clearButton.disabled = !administrator;
  }
}

async function claimClawbotAdministrator() {
  const button = actionButtons.get("clawbot-administrator-claim");
  const accountId = clawbotLoggedInAccountId();
  const peerId = clawbotInputValue("clawbot-administrator-select");
  if (!accountId || !peerId) {
    setClawbotOutput("clawbot-preview-output", "认领失败：请先登录，并选择一个由真实私聊识别的联系人。");
    return;
  }
  try {
    setBusy(button, true, "保存中");
    clawbotChannel.administrator = await requestJson("/api/channels/clawbot/administrator", {
      method: "PUT",
      body: JSON.stringify({ account_id: accountId, peer_id: peerId, bot_mention_aliases: [] }),
    });
    setClawbotOutput("clawbot-preview-output", `操作管理员已认领：${clawbotChannel.administrator.peer_name || peerId}`);
    await refreshClawbotWindow({ silent: true });
  } catch (error) {
    setClawbotOutput("clawbot-preview-output", `认领操作管理员失败：${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function clearClawbotAdministrator() {
  const button = actionButtons.get("clawbot-administrator-clear");
  const accountId = clawbotLoggedInAccountId();
  if (!accountId || !clawbotChannel.administrator) {
    return;
  }
  if (!window.confirm("确认撤销当前微信连接账号的操作管理员？撤销后将不能继续管理私聊绑定。")) {
    return;
  }
  try {
    setBusy(button, true, "撤销中");
    await requestJson(`/api/channels/clawbot/administrator?account_id=${encodeURIComponent(accountId)}`, {
      method: "DELETE",
    });
    setClawbotOutput("clawbot-preview-output", "操作管理员认领已撤销。");
    await refreshClawbotWindow({ silent: true });
  } catch (error) {
    setClawbotOutput("clawbot-preview-output", `撤销操作管理员失败：${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

function renderClawbotSidecarState() {
  const health = clawbotChannel.sidecarHealth || {};
  const provider = health.provider || {};
  const available = Boolean(health.available);
  const connected = !health.error && Boolean(health.sidecar_version || health.provider || health.gateway_base_url);
  const providerStatus = provider.online ? "provider 在线" : "provider 未在线";
  setClawbotText(
    "clawbot-sidecar-health",
    available ? "可用" : (connected ? "sidecar 已连接" : "sidecar 不可用"),
  );
  const detail = connected
    ? `版本 ${health.sidecar_version || "unknown"} · ${providerStatus}${provider.last_error ? ` · ${provider.last_error}` : ""}${health.last_tick_error ? ` · tick：${health.last_tick_error}` : ""}`
    : (health.error || provider.last_error || health.last_tick_error || "sidecar 不可用：未收到 sidecar 健康响应。");
  setClawbotText("clawbot-sidecar-detail", detail);
  setClawbotText(
    "clawbot-sidecar-provider",
    `provider：${provider.provider || "—"}${provider.provider_version ? ` / ${provider.provider_version}` : ""}${provider.account_id ? ` · ${provider.account_id}` : ""}`,
  );
  const card = document.querySelector(".clawbot-sidecar-card");
  card?.classList.toggle("is-online", connected);
  card?.classList.toggle("is-error", !connected);
}

function renderClawbotGatewayState() {
  const login = clawbotChannel.gatewayLogin || {};
  const metrics = clawbotChannel.gatewayMetrics || {};
  const state = String(login.state || "logged_out").toLowerCase();
  setClawbotText("clawbot-login-state", clawbotLoginLabel(state));
  setClawbotText("clawbot-inbox-completed", metrics.inbox_completed ?? 0);
  setClawbotText("clawbot-outbox-pending", metrics.outbox_pending ?? 0);
  setClawbotText("clawbot-outbox-dead-letter", metrics.outbox_dead_letter ?? 0);

  const qrImage = document.getElementById("clawbot-qr-image");
  const qrLink = document.getElementById("clawbot-qr-link");
  const qrHint = clawbotRole("clawbot-qr-hint");
  const qrData = typeof login.qr_code_data_url === "string" && login.qr_code_data_url.startsWith("data:image/")
    ? login.qr_code_data_url
    : "";
  const qrUrl = isClawbotQrLink(login.qr_code_data_url) ? login.qr_code_data_url : "";
  const generatedQrData = !qrData && qrUrl ? clawbotLiteappQrDataUrl(qrUrl) : "";
  const visibleQrData = qrData || generatedQrData;
  if (qrImage) {
    if (visibleQrData && state === "awaiting_scan") {
      qrImage.src = visibleQrData;
      qrImage.alt = generatedQrData ? "微信扫码登录二维码" : "微信连接登录二维码";
      qrImage.hidden = false;
    } else {
      qrImage.removeAttribute("src");
      qrImage.hidden = true;
    }
  }
  if (qrLink) {
    qrLink.href = qrUrl || "#";
    qrLink.hidden = true;
  }
  if (qrHint) {
    qrHint.hidden = Boolean(visibleQrData && state === "awaiting_scan");
    qrHint.textContent = state === "refresh_requested"
      ? "刷新请求已提交，等待 sidecar 上报二维码。"
      : state === "expired"
        ? "二维码已过期，请重新刷新。"
        : state === "online"
          ? `已登录${login.account_id ? `：${login.account_id}` : ""}`
          : qrUrl && state === "awaiting_scan"
            ? "二维码链接过长或生成失败，请刷新二维码后重试。"
          : state === "error"
            ? (login.last_error || "sidecar 报告登录错误。")
            : "点击刷新二维码，等待 sidecar 上报。";
  }
  setClawbotText(
    "clawbot-login-detail",
    login.last_error
      ? `最近错误：${login.last_error}`
      : `generation=${login.generation ?? 0} · 凭据仅由 sidecar 持有`,
  );
  const qrCard = document.querySelector(".clawbot-qr-card");
  qrCard?.classList.toggle("is-online", state === "online");
  qrCard?.classList.toggle("is-error", state === "error" || state === "expired");
}

function clawbotLoginNeedsPolling(state) {
  return ["refresh_requested", "awaiting_scan"].includes(String(state || "").toLowerCase());
}

function stopClawbotLoginPolling() {
  if (clawbotLoginPollTimer) {
    clearInterval(clawbotLoginPollTimer);
  }
  clawbotLoginPollTimer = null;
}

function setClawbotLoginStatusOutput(login = clawbotChannel.gatewayLogin || {}) {
  const state = String(login?.state || "").toLowerCase();
  if (state === "awaiting_scan") {
    setClawbotOutput("clawbot-preview-output", "二维码已刷新；请直接在微信连接登录卡片中用微信扫码。");
  } else if (state === "error") {
    setClawbotOutput(
      "clawbot-preview-output",
      `刷新微信连接二维码失败：${login?.last_error || "sidecar 未返回可用登录状态"}`,
    );
  } else if (state === "online") {
    setClawbotOutput(
      "clawbot-preview-output",
      `微信连接已登录${login?.account_id ? `：${login.account_id}` : ""}`,
    );
  } else {
    setClawbotOutput("clawbot-preview-output", `微信连接登录状态已更新：${clawbotLoginLabel(state)}`);
  }
}

async function pollClawbotLoginOnce() {
  if (clawbotLoginPollInFlight) {
    return;
  }
  clawbotLoginPollInFlight = true;
  try {
    clawbotChannel.gatewayLogin = await requestJson("/api/channels/clawbot/gateway/login/poll", {
      method: "POST",
      body: JSON.stringify({}),
    });
    renderClawbotGatewayState();
    if (!clawbotLoginNeedsPolling(clawbotChannel.gatewayLogin?.state)) {
      stopClawbotLoginPolling();
      setClawbotLoginStatusOutput(clawbotChannel.gatewayLogin);
      await refreshClawbotWindow({ silent: true });
    }
  } catch (error) {
    console.warn("clawbot login poll failed", error);
  } finally {
    clawbotLoginPollInFlight = false;
  }
}

function startClawbotLoginPolling() {
  if (clawbotLoginPollTimer || !clawbotLoginNeedsPolling(clawbotChannel.gatewayLogin?.state)) {
    return;
  }
  clawbotLoginPollTimer = setInterval(() => void pollClawbotLoginOnce(), 2000);
}

async function refreshClawbotLogin() {
  const button = actionButtons.get("clawbot-login-refresh");
  try {
    setBusy(button, true, "请求中");
    clawbotChannel.gatewayLogin = await requestJson("/api/channels/clawbot/gateway/login/refresh", {
      method: "POST",
      body: JSON.stringify({}),
    });
    renderClawbotGatewayState();
    const loginState = clawbotChannel.gatewayLogin?.state || "";
    if (clawbotLoginNeedsPolling(loginState)) {
      startClawbotLoginPolling();
    } else {
      stopClawbotLoginPolling();
    }
    setClawbotLoginStatusOutput(clawbotChannel.gatewayLogin);
  } catch (error) {
    setClawbotOutput("clawbot-preview-output", `刷新微信连接二维码失败：${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function logoutClawbotLogin() {
  const button = actionButtons.get("clawbot-login-logout");
  try {
    setBusy(button, true, "退出中");
    clawbotChannel.gatewayLogin = await requestJson("/api/channels/clawbot/gateway/login/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    stopClawbotLoginPolling();
    renderClawbotGatewayState();
    setClawbotOutput("clawbot-preview-output", "微信连接登录状态已清除；sidecar 应同步释放本地登录会话。 ");
  } catch (error) {
    setClawbotOutput("clawbot-preview-output", `退出微信连接登录失败：${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

// Phase 4 W3：微信连接主控台分段视图（绑定管理 / 私聊操作 / 管理员）。
function initClawbotSegments() {
  const tabs = Array.from(document.querySelectorAll("[data-clawbot-segment-tab]"));
  if (!tabs.length) {
    return;
  }
  const panels = Array.from(document.querySelectorAll("[data-clawbot-segment]"));
  const activate = (segment) => {
    tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.clawbotSegmentTab === segment);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.clawbotSegment !== segment;
    });
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.clawbotSegmentTab));
  });
  activate("binding");
}

function renderClawbotCommands(commands) {
  const list = clawbotRole("clawbot-command-list");
  if (!list) {
    return;
  }
  list.replaceChildren();
  const commandCount = clawbotRole("clawbot-command-count");
  if (commandCount) {
    commandCount.textContent = `${commands.length} 条`;
  }
  if (!commands.length) {
    const empty = document.createElement("div");
    empty.className = "clawbot-empty";
    empty.textContent = "命令清单未加载。";
    list.append(empty);
    return;
  }
  commands.forEach((command) => {
    const row = document.createElement("div");
    row.className = "clawbot-command-row";
    const name = document.createElement("span");
    name.textContent = command.name || "命令";
    const desc = document.createElement("small");
    desc.textContent = command.description || "等待说明";
    row.append(name, desc);
    list.append(row);
  });
}

function replaceClawbotRouteOptions(select, entries, placeholder, previousValue, preferredId, labelFor) {
  if (!select) {
    return;
  }
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.replaceChildren(placeholderOption);
  entries.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = labelFor(entry);
    select.append(option);
  });
  const selectedId = entries.some((entry) => entry.id === previousValue)
    ? previousValue
    : (entries.some((entry) => entry.id === preferredId) ? preferredId : "");
  select.value = selectedId;
}

function renderClawbotRouteOptions() {
  const roomRegistry = clawbotChannel.roomRegistry || chatRoomRegistry || {};
  const sessionCatalog = clawbotChannel.sessionRegistry || sessionRegistry || {};
  const rooms = Array.isArray(roomRegistry.rooms) ? roomRegistry.rooms : [];
  const sessions = Array.isArray(sessionCatalog.sessions) ? sessionCatalog.sessions : [];
  const roomSelect = clawbotRole("clawbot-room-id");
  const sessionSelect = clawbotRole("clawbot-session-id");
  const previousRoom = roomSelect?.value || "";
  const previousSession = sessionSelect?.value || "";
  const preferredRoom = rooms.find((room) => room.name === "测试环境")?.id
    || roomRegistry.active_room_id
    || "";
  const preferredSession = sessions.find((session) => (session.display_name || session.name) === "GLM5.2")?.id
    || sessionCatalog.active_session_id
    || "";
  replaceClawbotRouteOptions(
    roomSelect,
    rooms,
    "请选择已配置聊天室",
    previousRoom,
    preferredRoom,
    (room) => `${room.name || "未命名聊天室"} · ${room.id}`,
  );
  replaceClawbotRouteOptions(
    sessionSelect,
    sessions,
    "请选择已配置会话",
    previousSession,
    preferredSession,
    (session) => {
      const name = session.display_name || session.name || "未命名会话";
      return `${name} · ${session.provider || "未知 Provider"} / ${session.model || "未知模型"}`;
    },
  );
}

function clawbotRoomDisplayName(roomId) {
  const rooms = clawbotChannel.roomRegistry?.rooms || chatRoomRegistry?.rooms || [];
  const room = rooms.find((candidate) => candidate.id === roomId);
  return room ? `${room.name} (${room.id})` : (roomId || "未绑定");
}

function clawbotSessionDisplayName(sessionId) {
  const sessions = clawbotChannel.sessionRegistry?.sessions || sessionRegistry?.sessions || [];
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    return sessionId || "未绑定";
  }
  const name = session.display_name || session.name || session.id;
  return `${name} · ${session.provider || "未知 Provider"}/${session.model || "未知模型"} (${session.id})`;
}

function renderClawbotBindings(bindingsList) {
  const list = clawbotRole("clawbot-binding-list");
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (!bindingsList.length) {
    const empty = document.createElement("div");
    empty.className = "clawbot-empty";
    empty.textContent = "尚未绑定微信联系人。填写上方表单后保存即可创建。";
    list.append(empty);
    return;
  }
  // 同一联系人在历次 sidecar 登录会话下会积累不同 account_id 的旧绑定：
  // 当前登录账号的绑定排前，其余标记为「历史」并减淡，避免占据主视野。
  const activeAccount = clawbotLoggedInAccountId();
  const entries = bindingsList
    .map((binding, index) => ({ binding, index }))
    .sort((a, b) => {
      const aStale = activeAccount && a.binding.account_id !== activeAccount ? 1 : 0;
      const bStale = activeAccount && b.binding.account_id !== activeAccount ? 1 : 0;
      return aStale - bStale || a.index - b.index;
    });
  entries.forEach(({ binding, index }) => {
    const stale = Boolean(activeAccount && binding.account_id !== activeAccount);
    const card = document.createElement("article");
    card.className = "clawbot-binding-card" + (stale ? " is-stale" : "");
    const title = binding.peer_name || binding.peer_id || "未命名联系人";
    const targets = Array.isArray(binding.target_agent_ids) && binding.target_agent_ids.length
      ? binding.target_agent_ids.join(", ")
      : "默认接收者";
    card.innerHTML = `
      <div class="clawbot-binding-card-main">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(binding.account_id || "—")} / ${escapeHtml(binding.peer_id || "—")}</span>
        <small>room=${escapeHtml(clawbotRoomDisplayName(binding.chat_room_id))}</small>
        <small>session=${escapeHtml(clawbotSessionDisplayName(binding.default_session_id))}</small>
        <small>target=${escapeHtml(targets)} · workspace=${escapeHtml(binding.workspace_id || "default")}</small>
      </div>
      <div class="clawbot-binding-flags">
        <b class="${binding.allowlisted ? "is-on" : "is-off"}">${binding.allowlisted ? "Allowlist" : "Blocked"}</b>
        <b class="${binding.enabled ? "is-on" : "is-off"}">${binding.enabled ? "Enabled" : "Disabled"}</b>
        ${stale ? '<b class="is-stale-flag" title="该绑定属于旧登录会话生成的账号，当前登录账号不再使用它">历史</b>' : ""}
      </div>
    `;
    const button = document.createElement("button");
    button.className = "mini-button";
    button.type = "button";
    button.dataset.clawbotBindingIndex = String(index);
    button.textContent = "填入表单";
    card.append(button);
    list.append(card);
  });
}

function handleClawbotBindingListClick(event) {
  const trigger = event.target.closest("[data-clawbot-binding-index]");
  if (!trigger) {
    return;
  }
  const index = Number.parseInt(trigger.dataset.clawbotBindingIndex || "-1", 10);
  const binding = clawbotChannel.bindings?.[index];
  if (binding) {
    fillClawbotBindingForm(binding);
  }
}

function fillClawbotBindingForm(binding) {
  setClawbotInputValue("clawbot-account-id", binding.account_id || "");
  setClawbotInputValue("clawbot-peer-id", binding.peer_id || "");
  setClawbotInputValue("clawbot-peer-name", binding.peer_name || "");
  setClawbotInputValue("clawbot-room-id", binding.chat_room_id || "");
  setClawbotInputValue("clawbot-session-id", binding.default_session_id || "");
  setClawbotInputValue("clawbot-target-agents", (binding.target_agent_ids || []).join(", "));
  setClawbotChecked("clawbot-allowlisted", binding.allowlisted);
  setClawbotChecked("clawbot-enabled", binding.enabled);
  setClawbotInputValue("clawbot-command-account", binding.account_id || "");
  setClawbotInputValue("clawbot-command-peer", binding.peer_id || "");
  setClawbotOutput("clawbot-preview-output", `已载入 ${binding.peer_name || binding.peer_id} 的绑定，可修改后保存。`);
}

function currentClawbotBindingPayload() {
  return {
    account_id: clawbotInputValue("clawbot-account-id"),
    peer_id: clawbotInputValue("clawbot-peer-id"),
    peer_name: clawbotInputValue("clawbot-peer-name") || null,
    chat_room_id: clawbotInputValue("clawbot-room-id") || null,
    default_session_id: clawbotInputValue("clawbot-session-id") || null,
    target_agent_ids: clawbotTargetsFromText(clawbotInputValue("clawbot-target-agents")),
    workspace_id: activeWorkspaceKey || "default",
    last_context_token: null,
    allowlisted: Boolean(clawbotRole("clawbot-allowlisted")?.checked),
    enabled: Boolean(clawbotRole("clawbot-enabled")?.checked),
  };
}

async function saveClawbotBinding() {
  const button = actionButtons.get("clawbot-save-binding");
  const payload = currentClawbotBindingPayload();
  if (!payload.account_id || !payload.peer_id) {
    setClawbotOutput("clawbot-preview-output", "保存失败：微信账号与私聊联系人 ID 必填。");
    return;
  }
  try {
    setBusy(button, true, "保存中");
    const binding = await requestJson("/api/channels/clawbot/bindings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    clawbotChannel.lastResult = binding;
    fillClawbotBindingForm(binding);
    setClawbotOutput("clawbot-preview-output", binding);
    await refreshClawbotWindow({ silent: true });
  } catch (error) {
    setClawbotOutput("clawbot-preview-output", `保存绑定失败：${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function runClawbotPrivateCommand(commandText, outputRole, button) {
  const account_id = clawbotInputValue("clawbot-command-account") || clawbotInputValue("clawbot-account-id");
  const peer_id = clawbotInputValue("clawbot-command-peer") || clawbotInputValue("clawbot-peer-id");
  const command_text = String(commandText || "").trim();
  if (!account_id || !peer_id) {
    setClawbotOutput(outputRole, "执行失败：请先从联系人绑定列表载入一个已启用且已放行的私聊联系人。");
    return null;
  }
  if (!command_text.startsWith("/")) {
    setClawbotOutput(outputRole, "执行失败：请输入以 / 开头的有效微信命令。");
    return null;
  }
  setClawbotInputValue("clawbot-command-account", account_id);
  setClawbotInputValue("clawbot-command-peer", peer_id);
  setClawbotInputValue("clawbot-command-text", command_text);
  try {
    setBusy(button, true, "执行中");
    const result = await requestJson("/api/channels/clawbot/commands/execute", {
      method: "POST",
      body: JSON.stringify({
        account_id,
        peer_id,
        command_text,
        deliver_to_wechat: Boolean(clawbotRole("clawbot-command-deliver")?.checked),
      }),
    });
    const delivery = result.delivery_queued
      ? "\n\n已加入微信发送队列。"
      : "\n\n结果仅显示在本机，未回传微信。";
    const code = result.state === "failed" ? `[${result.code || "failed"}] ` : "";
    const text = `${code}${result.message || "命令没有返回内容。"}${delivery}`;
    setClawbotOutput(outputRole, text);
    setClawbotOutput("clawbot-command-result", text);
    setClawbotOutput("clawbot-preview-output", text);
    return result;
  } catch (error) {
    const message = `命令执行失败：${error.message}`;
    setClawbotOutput(outputRole, message);
    setClawbotOutput("clawbot-command-result", message);
    return null;
  } finally {
    setBusy(button, false);
  }
}

async function runClawbotFileAction(action) {
  const path = clawbotInputValue("clawbot-file-path");
  const button = actionButtons.get(`clawbot-file-${action}`);
  let commandText = "";
  if (action === "list") {
    commandText = `/file list ${path || "."}`;
  } else if (action === "write") {
    const content = clawbotInputValue("clawbot-file-content");
    if (!path || !content) {
      setClawbotOutput("clawbot-file-result", "写入失败：相对路径与写入内容均不能为空。");
      return;
    }
    commandText = `/file write ${path}\n${content}`;
  } else {
    if (!path) {
      setClawbotOutput("clawbot-file-result", "执行失败：请输入工作区内相对路径。");
      return;
    }
    commandText = `/file ${action} ${path}`;
  }
  await runClawbotPrivateCommand(commandText, "clawbot-file-result", button);
}

async function runClawbotTaskAction(action) {
  const selector = clawbotInputValue("clawbot-task-selector");
  const button = actionButtons.get(`clawbot-task-${action}`);
  let commandText = "/tasks";
  if (action === "detail") {
    if (!selector) {
      setClawbotOutput("clawbot-task-result", "查看详情前请输入任务编号或 ID。");
      return;
    }
    commandText = `/task ${selector}`;
  } else if (action === "continue") {
    if (!selector) {
      setClawbotOutput("clawbot-task-result", "继续任务前请输入任务编号或 ID。");
      return;
    }
    commandText = `/continue ${selector}`;
  } else if (action === "stop") {
    commandText = selector ? `/stop ${selector}` : "/stop";
  }
  await runClawbotPrivateCommand(commandText, "clawbot-task-result", button);
}

async function applyClawbotCommandFromForm() {
  const button = actionButtons.get("clawbot-apply-command");
  const commandText = clawbotInputValue("clawbot-command-text");
  await runClawbotPrivateCommand(commandText, "clawbot-command-result", button);
}

// 舰桥船员 → 对应工作窗口（点击直达）：Commander→设置 / Operations→任务授权 / Memory→记忆 / Envoy→聊天室。
const OFFICE_ROBOT_WINDOW = {
  commander: "settings",
  pilot: "browser",
  operations: "tasks",
  memory: "memory",
  envoy: "chat",
  security: "tasks",
};
let bridgeVisualEffectsStarted = false;
let bridgeThreeModulePromise = null;

async function loadOfficeScene({ silent = false } = {}) {
  const scene = document.querySelector('[data-role="office-scene"]');
  if (!scene) {
    return;
  }
  ensureOfficeSceneInteractions(scene);
  try {
    const data = await requestJson("/api/office/scene");
    officeSceneState = data;
    renderOfficeScene(data);
  } catch (error) {
    if (!silent) {
      renderOfficeSceneError(error);
    }
  }
}

// 舰桥交互（事件委托一次性绑定）：船员点击 → 打开对应窗口。
function ensureOfficeSceneInteractions(scene) {
  if (!scene || scene.dataset.interactionsBound === "1") {
    return;
  }
  scene.dataset.interactionsBound = "1";
  scene.addEventListener("click", (event) => {
    const crew = event.target.closest(".bridge-crewmate");
    if (crew) {
      const target = OFFICE_ROBOT_WINDOW[crew.dataset.crewId];
      if (target) {
        document.querySelector(`[data-window-target="${target}"]`)?.click();
      }
      return;
    }
  });
}

function renderOfficeScene(scene) {
  if (!scene) {
    return;
  }
  const robotsHost = document.querySelector('[data-role="office-robots"]');
  if (robotsHost) {
    robotsHost.replaceChildren(...(scene.robots || []).map(renderBridgeCrewmate));
  }
}

function renderOfficeSceneError(error) {
  console.warn("Starship bridge scene sync failed:", error);
}

function renderBridgeCrewmate(robot) {
  const node = document.createElement("article");
  node.className = `bridge-crewmate ${officeRobotStateClass(robot?.state)}`;
  node.dataset.crewId = robot?.id || "crew";
  node.dataset.kind = robot?.kind || "astronaut";
  node.dataset.lane = robot?.lane || "middle";
  const x = Number.isFinite(Number(robot?.x)) ? Number(robot.x) : 50;
  const y = Number.isFinite(Number(robot?.y)) ? Number(robot.y) : 58;
  node.style.setProperty("--x", String(x));
  node.style.setProperty("--y", String(y));
  node.style.zIndex = String(Math.max(1, Math.round(y)));
  const avatar = avatarUrl(robot?.avatar || "assets/ui-redesign/bridge/crew-astronaut-pilot.png");
  node.innerHTML = `
    <img class="crew-avatar" src="${escapeHtml(avatar)}" alt="" />
  `;
  return node;
}

function officeRobotStateClass(state) {
  const normalized = String(state || "idle").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `is-${normalized || "idle"}`;
}

function initializeBridgeVisualEffects() {
  if (bridgeVisualEffectsStarted) {
    return;
  }
  bridgeVisualEffectsStarted = true;
  const flightCanvas = document.querySelector('[data-role="bridge-webgl-flight-canvas"]');
  const earthCanvas = document.querySelector('[data-role="bridge-hologram-earth-canvas"]');
  if (!flightCanvas && !earthCanvas) {
    return;
  }
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) {
    document.body.classList.add("bridge-webgl-reduced-motion");
    return;
  }
  loadThreeModule()
    .then((THREE) => {
      initBridgeFlightScene(THREE, flightCanvas);
      initBridgeHologramEarthScene(THREE, earthCanvas);
    })
    .catch((error) => {
      console.warn("Bridge WebGL effects unavailable", error);
      document.body.classList.add("bridge-webgl-unavailable");
    });
}

const bridgeVisualResizeCallbacks = new Set();
let bridgeVisualResizeFrame = 0;
let bridgeVisualResizeTimer = 0;

function requestBridgeVisualEffectsResize() {
  if (!bridgeVisualResizeCallbacks.size) {
    return;
  }
  const run = () => {
    bridgeVisualResizeFrame = 0;
    bridgeVisualResizeCallbacks.forEach((resize) => resize());
  };
  if (!bridgeVisualResizeFrame) {
    bridgeVisualResizeFrame = requestAnimationFrame(run);
  }
  window.clearTimeout(bridgeVisualResizeTimer);
  bridgeVisualResizeTimer = window.setTimeout(() => {
    bridgeVisualResizeCallbacks.forEach((resize) => resize());
  }, 140);
}

function loadThreeModule() {
  if (!bridgeThreeModulePromise) {
    const url = new URL("./assets/vendor/three.module.min.js", document.baseURI).href;
    bridgeThreeModulePromise = import(url);
  }
  return bridgeThreeModulePromise;
}

function initBridgeFlightScene(THREE, canvas) {
  if (!THREE || !canvas) {
    return;
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);
  camera.position.z = 18;

  const starCount = 420;
  const positions = new Float32Array(starCount * 3);
  const velocities = new Float32Array(starCount);
  for (let index = 0; index < starCount; index += 1) {
    seedBridgeStar(positions, velocities, index, true);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x9be8ff,
    size: 2.15,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spriteUrl = new URL("./assets/ui-redesign/bridge/starfield-flight-texture.png", document.baseURI).href;
  new THREE.TextureLoader().load(spriteUrl, (texture) => {
    if ("SRGBColorSpace" in THREE) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    material.map = texture;
    material.needsUpdate = true;
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let lastTime = performance.now();
  const resize = () => resizeBridgeRenderer(renderer, canvas, camera);
  observeBridgeCanvasResize(canvas, resize);
  const animate = (now) => {
    const delta = Math.min((now - lastTime) / 1000, 0.045);
    lastTime = now;
    for (let index = 0; index < starCount; index += 1) {
      const offset = index * 3;
      positions[offset + 2] += velocities[index] * delta;
      if (positions[offset + 2] > 22) {
        seedBridgeStar(positions, velocities, index, false);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    points.rotation.z += delta * 0.006;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  canvas.dataset.webglReady = "1";
  requestAnimationFrame(animate);
}

function seedBridgeStar(positions, velocities, index, spreadDepth) {
  const offset = index * 3;
  const depth = spreadDepth ? -(80 + Math.random() * 900) : -(760 + Math.random() * 220);
  const spread = 26 + Math.abs(depth) * 0.072;
  positions[offset] = (Math.random() - 0.5) * spread * 2.35;
  positions[offset + 1] = (Math.random() - 0.5) * spread * 0.82;
  positions[offset + 2] = depth;
  velocities[index] = 130 + Math.random() * 165;
}

function initBridgeHologramEarthScene(THREE, canvas) {
  if (!THREE || !canvas) {
    return;
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
  camera.position.z = 3.4;

  const group = new THREE.Group();
  const globeMaterial = new THREE.MeshBasicMaterial({
    color: 0x86f7ff,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const textureUrl = new URL("./assets/ui-redesign/bridge/hologram-earth-texture.png", document.baseURI).href;
  new THREE.TextureLoader().load(textureUrl, (texture) => {
    if ("SRGBColorSpace" in THREE) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    globeMaterial.map = texture;
    globeMaterial.needsUpdate = true;
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), globeMaterial);
  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 28, 14),
    new THREE.MeshBasicMaterial({
      color: 0x9ffcff,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(1.22, 0.008, 8, 96),
    new THREE.MeshBasicMaterial({
      color: 0x75edff,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  orbit.rotation.x = Math.PI / 2.8;
  orbit.rotation.z = -0.25;
  group.add(globe, wire, orbit);
  scene.add(group);

  let lastTime = performance.now();
  const resize = () => resizeBridgeRenderer(renderer, canvas, camera);
  observeBridgeCanvasResize(canvas, resize);
  const animate = (now) => {
    const delta = Math.min((now - lastTime) / 1000, 0.045);
    lastTime = now;
    globe.rotation.y += delta * 0.24;
    wire.rotation.y += delta * 0.18;
    orbit.rotation.z += delta * 0.12;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  canvas.dataset.webglReady = "1";
  requestAnimationFrame(animate);
}

function resizeBridgeRenderer(renderer, canvas, camera) {
  const rect = canvas.getBoundingClientRect();
  const fallback = rect.width > 1 && rect.height > 1
    ? null
    : canvas.closest(".bridge-hologram-earth, .bridge-viewport, .agent-office-scene")?.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width > 1 ? rect.width : fallback?.width || 1));
  const height = Math.max(1, Math.round(rect.height > 1 ? rect.height : fallback?.height || 1));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  canvas.dataset.webglWidth = String(width);
  canvas.dataset.webglHeight = String(height);
}

function observeBridgeCanvasResize(canvas, resize) {
  bridgeVisualResizeCallbacks.add(resize);
  resize();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);
    const host = canvas.closest(".bridge-hologram-earth, .bridge-viewport, .agent-office-scene");
    if (host) {
      observer.observe(host);
    }
  }
  window.addEventListener("resize", resize, { passive: true });
}

// ---------------------------------------------------------------------------
// REQ-TOOL-008 Phase C-7：工具审批面板
// ---------------------------------------------------------------------------

const toolApproval = {
  activeCallId: null,
  source: null,
  retryMs: 1500,
  retryTimer: null,
};

function startToolApprovalStream() {
  const panel = document.querySelector('[data-role="tool-approval-panel"]');
  if (!panel || typeof EventSource === "undefined") return;

  document
    .querySelector('[data-action="approval-approve-once"]')
    ?.addEventListener("click", () => respondToApproval("approve", "once"));
  document
    .querySelector('[data-action="approval-approve-session"]')
    ?.addEventListener("click", () => respondToApproval("approve", "session"));
  document
    .querySelector('[data-action="approval-reject"]')
    ?.addEventListener("click", () => respondToApproval("reject"));

  connectToolEventSource();
}

function connectToolEventSource() {
  if (toolApproval.source) {
    try { toolApproval.source.close(); } catch { /* ignore */ }
  }
  const source = new EventSource("/api/tools/events");
  toolApproval.source = source;

  source.addEventListener("permission-required", (event) => {
    const record = safeJsonParse(event.data);
    if (record) renderApprovalPanel(record);
  });
  source.addEventListener("approved", (event) => {
    const payload = safeJsonParse(event.data);
    if (payload && payload.call_id === toolApproval.activeCallId) {
      hideApprovalPanel();
    }
  });
  source.addEventListener("rejected", (event) => {
    const payload = safeJsonParse(event.data);
    if (payload && payload.call_id === toolApproval.activeCallId) {
      hideApprovalPanel();
    }
  });
  source.addEventListener("lagged", () => {
    // 发生 lagged 时服务端建议前端拉一次 /api/tools/pending 补齐
    refreshPendingApprovals();
  });
  source.onerror = () => {
    if (toolApproval.retryTimer) return;
    toolApproval.retryTimer = window.setTimeout(() => {
      toolApproval.retryTimer = null;
      connectToolEventSource();
    }, toolApproval.retryMs);
  };
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function chatMessageList() {
  return document.querySelector('[data-role="chat-message-list"]');
}

async function refreshPendingApprovals() {
  try {
    const res = await fetch("/api/tools/pending");
    if (!res.ok) return;
    const data = await res.json();
    taskPendingApprovals = Array.isArray(data.pending) ? data.pending : [];
    taskRenderApprovals(taskPendingApprovals);
    const first = taskPendingApprovals[0];
    if (first) renderApprovalPanel(first);
  } catch {
    taskRenderApprovals(taskPendingApprovals);
  }
}

function renderApprovalPanel(record) {
  const panel = document.querySelector('[data-role="tool-approval-panel"]');
  if (!panel) return;
  taskUpsertApproval(record);
  toolApproval.activeCallId = record.call_id;
  setBindText("approval.toolName", record.tool_name || "-");
  setBindText("approval.caller", record.caller || "-");
  setBindText("approval.inputSummary", record.input_summary || "-");
  const perm = record.permission || {};
  setBindText("approval.decisionLabel", perm.decision || "等待");
  setBindText("approval.reason", perm.reason || "-");
  const paths = Array.isArray(perm.affected_paths) ? perm.affected_paths.join(", ") : "";
  setBindText("approval.affectedPaths", paths || "-");
  panel.hidden = false;
}

function hideApprovalPanel() {
  const panel = document.querySelector('[data-role="tool-approval-panel"]');
  if (!panel) return;
  const callId = toolApproval.activeCallId;
  panel.hidden = true;
  toolApproval.activeCallId = null;
  if (callId) {
    taskPendingApprovals = taskPendingApprovals.filter((item) => item.call_id !== callId);
    taskRenderApprovals(taskPendingApprovals);
  }
}

function setBindText(key, text) {
  const node = bindings.get(key);
  if (node) node.textContent = text;
}

async function respondToApproval(kind, scope) {
  const callId = toolApproval.activeCallId;
  if (!callId) return;
  const url = kind === "approve" ? "/api/tools/approve" : "/api/tools/reject";
  const body = kind === "approve"
    ? { call_id: callId, scope: scope || "once", confirmed_twice: false }
    : { call_id: callId, reason: "user-rejected" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[tool-approval]", url, res.status);
      return;
    }
    hideApprovalPanel();
    // 审批完成后刷新审计记录，给用户"刚刚做了什么"的即时反馈
    refreshToolAudit();
    refreshPendingApprovals();
  } catch (err) {
    console.warn("[tool-approval] network error", err);
  }
}

// ---------------------------------------------------------------------------
// REQ-TOOL-009 Phase C-8：工具调用记录（审计）前端
// ---------------------------------------------------------------------------

async function refreshToolAudit() {
  const body = document.querySelector('[data-role="tool-audit-body"]');
  if (!body) return;
  const summary = bindings.get("tools.auditSummary");
  try {
    const res = await fetch("/api/tools/audit?limit=50");
    if (!res.ok) {
      if (summary) summary.textContent = `加载失败 ${res.status}`;
      return;
    }
    const data = await res.json();
    taskAuditEntries = data.entries || [];
    renderToolAudit(body, taskAuditEntries);
    taskRenderAuditSummary(taskAuditEntries);
    if (summary) summary.textContent = `最近 ${taskAuditEntries.length} 条`;
  } catch (err) {
    if (summary) summary.textContent = "网络错误";
    taskRenderAuditSummary(taskAuditEntries);
    console.warn("[tool-audit] fetch failed", err);
  }
}

function renderToolAudit(body, entries) {
  body.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "tool-audit-empty";
    empty.textContent = "暂无审计记录";
    body.appendChild(empty);
    return;
  }
  // 新的在前
  const ordered = entries.slice().reverse();
  const table = document.createElement("table");
  table.className = "tool-audit-table";
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>时间</th><th>工具</th><th>调用方</th><th>状态</th><th>决策</th><th>耗时</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const entry of ordered) {
    const tr = document.createElement("tr");
    tr.dataset.callId = entry.call_id || "";

    const tsCell = document.createElement("td");
    tsCell.textContent = formatAuditTs(entry.ts);
    tr.appendChild(tsCell);

    const toolCell = document.createElement("td");
    toolCell.className = "mono";
    toolCell.textContent = entry.tool_name || "-";
    tr.appendChild(toolCell);

    const callerCell = document.createElement("td");
    callerCell.textContent = entry.caller || "-";
    tr.appendChild(callerCell);

    const statusCell = document.createElement("td");
    statusCell.className = `status status-${entry.status || "unknown"}`;
    statusCell.textContent = entry.status || "-";
    tr.appendChild(statusCell);

    const decisionCell = document.createElement("td");
    const perm = entry.permission || {};
    decisionCell.textContent = perm.decision || "-";
    if (perm.protected_match) {
      decisionCell.title = `protected: ${perm.protected_match}`;
    }
    tr.appendChild(decisionCell);

    const elapsedCell = document.createElement("td");
    elapsedCell.textContent = entry.elapsed_ms == null ? "-" : `${entry.elapsed_ms}ms`;
    tr.appendChild(elapsedCell);

    // 展开行：点击主行后展开 input_summary + reason + affected_paths
    const detail = document.createElement("tr");
    detail.className = "tool-audit-detail";
    detail.hidden = true;
    const detailCell = document.createElement("td");
    detailCell.colSpan = 6;
    detailCell.innerHTML = `
      <div><b>call_id</b>: ${escapeHtml(entry.call_id || "")}</div>
      <div><b>workspace</b>: ${escapeHtml(entry.workspace_id || "")}</div>
      <div><b>session</b>: ${escapeHtml(entry.session_id || "")}</div>
      <div><b>input</b>: <code>${escapeHtml(entry.input_summary || "")}</code></div>
      <div><b>reason</b>: ${escapeHtml(perm.reason || "")}</div>
      <div><b>paths</b>: ${escapeHtml((perm.affected_paths || []).join(", "))}</div>
      <div><b>summary</b>: ${escapeHtml(entry.summary_text || "")}</div>
    `;
    detail.appendChild(detailCell);

    tr.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
    });

    tbody.appendChild(tr);
    tbody.appendChild(detail);
  }
  table.appendChild(tbody);
  body.appendChild(table);
}

const TOOL_CALL_STATUS_META = {
  idle: { className: "is-idle", text: "tool_call_idle", label: "未调用" },
  running: { className: "is-running", text: "tool_call_running", label: "执行中" },
  complete: { className: "is-complete", text: "tool_call_complete", label: "执行完成" },
  error: { className: "is-error", text: "tool_call_error", label: "执行失败" },
};

function normalizeToolCallStatus(status) {
  if (status === "running" || status === "complete" || status === "error" || status === "failed") {
    if (status === "failed") {
      return "error";
    }
    return status;
  }
  return "idle";
}

function toolCallStatusMeta(toolId) {
  const current = toolCallStatuses.get(toolId) || { status: "idle" };
  return TOOL_CALL_STATUS_META[normalizeToolCallStatus(current.status)] || TOOL_CALL_STATUS_META.idle;
}

function renderToolCallIndicator(toolId, label) {
  const status = toolCallStatusMeta(toolId);
  const indicator = document.createElement("span");
  indicator.className = `tool-call-indicator ${status.className}`;
  indicator.dataset.toolCallId = toolId;
  indicator.dataset.toolCallLabel = label;
  indicator.title = `${label}: ${status.label}`;
  indicator.setAttribute("aria-label", `${label}: ${status.label}`);
  indicator.append(document.createElement("i"));
  const text = document.createElement("b");
  text.textContent = status.text;
  indicator.append(text);
  return indicator;
}

function renderToolStatusStrip(catalog = toolCatalog) {
  const host = document.querySelector('[data-role="tool-status-strip"]');
  if (!host) {
    return;
  }
  const known = new Map([["tools.semantic_dispatch", "Semantic dispatch"]]);
  (catalog.categories || []).forEach((category) => {
    (category.items || []).slice(0, 3).forEach((item) => {
      known.set(item.id, item.display_name || item.name || item.id);
    });
  });
  host.replaceChildren(
    ...Array.from(known.entries())
      .slice(0, 8)
      .map(([toolId, label]) => renderToolCallIndicator(toolId, label))
  );
}

function syncToolCallStatusUi(toolId) {
  document.querySelectorAll(`[data-tool-call-id="${CSS.escape(toolId)}"]`).forEach((node) => {
    const label = node.dataset.toolCallLabel || toolId;
    const status = toolCallStatusMeta(toolId);
    node.classList.remove("is-idle", "is-running", "is-complete", "is-error");
    node.classList.add(status.className);
    node.title = `${label}: ${status.label}`;
    node.setAttribute("aria-label", `${label}: ${status.label}`);
    const text = node.querySelector("b");
    if (text) {
      text.textContent = status.text;
    }
  });
}

function setToolCallStatus(toolId, status, label = toolId) {
  if (!toolId) {
    return;
  }
  toolCallStatuses.set(toolId, {
    status: normalizeToolCallStatus(status),
    label,
    updated_at: Date.now(),
  });
  if (!document.querySelector(`[data-tool-call-id="${CSS.escape(toolId)}"]`)) {
    renderToolStatusStrip(toolCatalog);
  }
  document.querySelectorAll(`[data-tool-call-id="${CSS.escape(toolId)}"]`).forEach((node) => {
    node.dataset.toolCallLabel = label;
  });
  syncToolCallStatusUi(toolId);
}

function formatAuditTs(ts) {
  if (!ts) return "-";
  const secs = Number.parseFloat(ts);
  if (!Number.isFinite(secs)) return ts;
  const d = new Date(secs * 1000);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeHtml(str) {
  return (str == null ? "" : String(str))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function taskInitializeWindow() {
  taskRenderGoals(taskGoals);
  taskRenderApprovals(taskPendingApprovals);
  taskRenderProtectedRules(taskProtectedRules);
  taskRenderFullAccessStatus(taskFullAccessStatus);
  taskRenderHandoffSummary(chatHandoffs);
  taskRenderAuditSummary(taskAuditEntries);
  taskRenderSchedules(taskScheduleRegistry);
  taskScheduleSyncKindVisibility();
  renderOverviewActiveRoles(goalRoleRegistry.roles || []);
  renderGoalRoleAssignmentMatrix();
  syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
}

async function taskRefreshWindow() {
  await Promise.allSettled([
    refreshPendingApprovals(),
    refreshToolAudit(),
    refreshAllowedRoots(),
    refreshFullAccessStatus(),
    refreshTaskSchedules(),
    refreshGoalRoleRisks(),
    refreshGoals(),
    activeChatRoomId ? refreshChatCollaboration(activeChatRoomId) : Promise.resolve(),
  ]);
}

async function refreshGoalRoleRisks() {
  try {
    goalRoleRegistry = await requestJson("/api/goals/roles");
    taskRenderGoalRoleRisks(goalRoleRegistry.roles || []);
    renderOverviewActiveRoles(goalRoleRegistry.roles || []);
    renderGoalRoleAssignmentMatrix();
    setGoalRoleForm(activeSessionId);
  } catch (error) {
    taskRenderGoalRoleRisks([], error);
    renderOverviewActiveRoles([]);
    renderGoalRoleAssignmentMatrix();
  }
}

async function refreshGoals() {
  try {
    const data = await requestJson("/api/goals?limit=30");
    taskGoals = Array.isArray(data.goals) ? data.goals : [];
    taskRenderGoals(taskGoals);
    syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
    syncGoalRefreshPolling(taskGoals);
    refreshOpenGoalTaskChain();
  } catch (error) {
    taskRenderGoals(taskGoals, error);
    syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
    syncGoalRefreshPolling(taskGoals);
    refreshOpenGoalTaskChain();
  }
}

async function autoStartReadyGoalLoops() {
  const ready = (Array.isArray(taskGoals) ? taskGoals : []).filter(goalReadyForAutoLoop);
  for (const goal of ready) {
    autoStartedGoalLoopIds.add(goal.id);
    try {
      await requestJson(`/api/goals/${encodeURIComponent(goal.id)}/loop/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_steps: 20 }),
      });
      refreshOpenGoalTaskChain(goal.id);
    } catch (error) {
      autoStartedGoalLoopIds.delete(goal.id);
      console.warn("Auto-start goal loop failed:", error);
    }
  }
  if (ready.length) {
    await refreshGoals();
  }
}

function goalReadyForAutoLoop(goal) {
  if (!goal?.id || autoStartedGoalLoopIds.has(goal.id)) {
    return false;
  }
  if (["completed", "cancelled", "paused"].includes(String(goal.status || "").toLowerCase())) {
    return false;
  }
  if (!Array.isArray(goal.phases) || goal.phases.length === 0) {
    return false;
  }
  if (goal.phases.every((phase) => phase.status === "completed")) {
    return false;
  }
  return (goal.recent_events || []).some((event) => (
    event.event_type === "goal-role-consultation" && event.payload?.roles_ready === true
  ));
}

async function refreshTaskSchedules() {
  try {
    // 目标列表用于 Goal 推进型绑定；失败不阻塞定时任务渲染（目标可选）。
    try {
      taskScheduleGoalRegistry = await requestJson("/api/goals");
    } catch (_goalError) {
      taskScheduleGoalRegistry = { goals: [] };
    }
    taskScheduleRegistry = await requestJson("/api/task-schedules");
    taskRenderSchedules(taskScheduleRegistry);
    loadRelayTimeout();
  } catch (error) {
    taskRenderSchedules({ tasks: [], due_count: 0 }, error);
  }
}

// 接力式群发的单会话超时（秒），来自 config.session.relay_timeout_ms；用于定时任务面板的"接力超时"控件。
async function loadRelayTimeout() {
  const input = document.querySelector('[data-role="task-schedule-relay-timeout"]');
  if (!input) {
    return;
  }
  try {
    const cfg = await requestJson("/api/chat/relay-config");
    if (cfg && Number.isFinite(cfg.relay_timeout_seconds)) {
      input.value = cfg.relay_timeout_seconds;
    }
  } catch (_error) {
    // 配置可选：读取失败保留默认值，不打断面板。
  }
}

async function saveRelayTimeout(event) {
  const button = event?.currentTarget || actionButtons.get("task-schedule-relay-timeout-save");
  const input = document.querySelector('[data-role="task-schedule-relay-timeout"]');
  const seconds = Number.parseInt(input?.value, 10);
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 600) {
    addMessage({ author: "定时任务", text: "接力超时需为 5-600 秒。", kind: "thought", icon: "warn-log" });
    return;
  }
  setBusy(button, true, "Saving");
  try {
    const cfg = await requestJson("/api/chat/relay-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relay_timeout_seconds: seconds }),
    });
    if (input && cfg && Number.isFinite(cfg.relay_timeout_seconds)) {
      input.value = cfg.relay_timeout_seconds;
    }
    addMessage({ author: "定时任务", text: `接力超时已设为 ${cfg.relay_timeout_seconds} 秒。`, kind: "thought", icon: "ok-log" });
  } catch (error) {
    addMessage({ author: "定时任务", text: `保存接力超时失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

// ===== 权限三档之第二档：workspace 外目录授权（任务4）=====
async function refreshAllowedRoots() {
  try {
    const data = await requestJson("/api/tools/allowed-roots");
    renderAllowedRoots(Array.isArray(data.roots) ? data.roots : []);
  } catch (error) {
    renderAllowedRoots([], error);
  }
  try {
    const ws = await requestJson("/api/workspace");
    setText("tasks.currentWorkspace", ws.workspace || "—");
  } catch (_) {}
}

function renderAllowedRoots(roots, error) {
  const list = document.querySelector('[data-role="allowed-root-list"]');
  if (!list) return;
  if (error) {
    list.innerHTML = '<div class="task-window-empty">加载授权目录失败。</div>';
    return;
  }
  if (!roots.length) {
    list.innerHTML = '<div class="task-window-empty">暂无外部目录授权。</div>';
    return;
  }
  list.innerHTML = "";
  for (const root of roots) {
    const row = document.createElement("div");
    row.className = "auth-dir-row";
    const span = document.createElement("span");
    span.className = "auth-dir-path";
    span.textContent = root.replace(/^\\\\\?\\/, "");
    span.title = root;
    const btn = document.createElement("button");
    btn.className = "mini-button";
    btn.type = "button";
    btn.textContent = "撤销";
    btn.addEventListener("click", () => allowedRootRemove(root));
    row.append(span, btn);
    list.appendChild(row);
  }
}

async function allowedRootAdd() {
  const input = document.querySelector('[data-role="allowed-root-input"]');
  const path = input?.value?.trim();
  if (!path) return;
  const btn = actionButtons.get("allowed-root-add");
  setBusy(btn, true, "授权中");
  try {
    const data = await requestJson("/api/tools/allowed-roots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (input) input.value = "";
    renderAllowedRoots(Array.isArray(data.roots) ? data.roots : []);
  } catch (error) {
    alert("授权目录失败：" + error.message);
  } finally {
    setBusy(btn, false);
  }
}

async function allowedRootRemove(path) {
  try {
    const data = await requestJson("/api/tools/allowed-roots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    renderAllowedRoots(Array.isArray(data.roots) ? data.roots : []);
  } catch (error) {
    alert("撤销失败：" + error.message);
  }
}

function renderTaskScheduleSessionOptions() {
  const select = document.querySelector('[data-role="task-schedule-session"]');
  if (!select) {
    return;
  }
  const current = select.value || activeSessionId || "";
  select.replaceChildren();
  (sessionRegistry.sessions || []).forEach((session) => {
    const option = document.createElement("option");
    option.value = session.id;
    option.textContent = session.display_name || session.name || session.id;
    select.append(option);
  });
  if (current) {
    select.value = current;
  }
}

// Goal 推进型：把可绑定目标填入选择器（数据来自 refreshTaskSchedules 拉取的 /api/goals）。
function renderTaskScheduleGoalOptions() {
  const select = document.querySelector('[data-role="task-schedule-goal"]');
  if (!select) {
    return;
  }
  const current = select.value || "";
  select.replaceChildren();
  const goals = taskScheduleGoalRegistry.goals || [];
  if (!goals.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "（暂无目标，请先在 Goal 模式创建）";
    select.append(option);
    return;
  }
  goals.forEach((goal) => {
    const option = document.createElement("option");
    option.value = goal.id;
    const status = goal.status ? ` [${goal.status}]` : "";
    option.textContent = `${goal.title || goal.id}${status}`;
    select.append(option);
  });
  if (current) {
    select.value = current;
  }
}

// 任务类型切换：Goal 推进型显示目标选择器并调整内容输入框提示。
function taskScheduleSyncTaskKindVisibility() {
  const kind = document.querySelector('[data-role="task-schedule-task-kind"]')?.value || "poll";
  const goalSelect = document.querySelector('[data-role="task-schedule-goal"]');
  const content = document.querySelector('[data-role="task-schedule-content"]');
  if (goalSelect) {
    goalSelect.hidden = kind !== "goal";
  }
  if (content) {
    content.placeholder =
      kind === "goal"
        ? "目标说明（Goal 推进型：每次到点推进一个阶段，整体完成后自动停止）"
        : "发送给目标会话的任务内容（轮询型：每次发送相同内容）";
  }
}

function taskRenderSchedules(registry = {}, error = null) {
  renderTaskScheduleSessionOptions();
  renderTaskScheduleGoalOptions();
  taskScheduleSyncTaskKindVisibility();
  const list = document.querySelector('[data-role="task-schedule-list"]');
  setBindText("tasks.scheduleDue", `${registry.due_count || 0} due`);
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (error) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = `Task schedules load failed: ${error.message}`;
    list.append(empty);
    return;
  }
  const tasks = registry.tasks || [];
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "No scheduled tasks.";
    list.append(empty);
    return;
  }
  const describeSchedule = (task) => {
    const hh = String(task.wall_hour ?? 0).padStart(2, "0");
    const mm = String(task.wall_minute ?? 0).padStart(2, "0");
    const names = ["日", "一", "二", "三", "四", "五", "六"];
    if (task.schedule_kind === "daily") return `每天 ${hh}:${mm}`;
    if (task.schedule_kind === "weekly") {
      const days = (task.weekdays || []).map((d) => "周" + (names[d] || d)).join("、");
      return `每周${days || "（全周）"} ${hh}:${mm}`;
    }
    if (task.schedule_kind === "interval" && task.interval_ms) {
      return `每 ${Math.round(task.interval_ms / 60000)} 分钟`;
    }
    return "一次性";
  };
  const goalTitleOf = (goalId) => {
    const goal = (taskScheduleGoalRegistry.goals || []).find((item) => item.id === goalId);
    return goal ? goal.title || goal.id : goalId;
  };
  function taskScheduleMetaLine(task, describeSchedule) {
    const parts = [describeSchedule(task)];
    const runAt = Number(task.run_at_ms || 0);
    if (Number.isFinite(runAt) && runAt > 0) {
      parts.push(`下次 ${new Date(runAt).toLocaleString()}`);
    }
    const status = String(task.status || "").trim();
    if (status && !["scheduled", "pending"].includes(status.toLowerCase())) {
      parts.push(status);
    }
    return parts.join(" · ");
  }
  tasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-schedule-item is-${task.status || "scheduled"}`;
    const isGoal = task.task_kind === "goal";
    const kindBadge = isGoal ? "🎯 Goal 推进" : "🔁 轮询";
    const goalLine =
      isGoal && task.goal_id
        ? `<small class="task-schedule-goal-line">目标：${escapeHtml(goalTitleOf(task.goal_id))}</small>`
        : "";
    const errLine = task.last_error
      ? `<small class="task-schedule-error">⚠ ${escapeHtml(task.last_error)}</small>`
      : "";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(task.target_session_name || task.target_session_id || "-")}</strong>
        <span class="task-schedule-badge ${isGoal ? "is-goal" : "is-poll"}">${kindBadge}</span>
        <p>${escapeHtml(task.content || "")}</p>
        ${goalLine}
        <small>${escapeHtml(taskScheduleMetaLine(task, describeSchedule))}</small>
        ${errLine}
      </div>
      <button type="button" class="task-schedule-delete" data-schedule-delete="${escapeHtml(task.id || "")}">Delete</button>
    `;
    list.append(item);
  });
}

function taskScheduleSyncKindVisibility() {
  const kind = document.querySelector('[data-role="task-schedule-kind"]')?.value || "daily";
  const wall = document.querySelector('[data-role="task-schedule-wall-time"]');
  const week = document.querySelector('[data-role="task-schedule-weekdays"]');
  const once = document.querySelector('[data-role="task-schedule-time"]');
  const interval = document.querySelector('[data-role="task-schedule-interval-min"]');
  if (wall) wall.hidden = !(kind === "daily" || kind === "weekly");
  if (week) week.hidden = kind !== "weekly";
  if (once) once.hidden = kind !== "once";
  if (interval) interval.hidden = kind !== "interval";
}

function taskSchedulePayloadFromForm() {
  const permissions = [];
  if (document.querySelector('[data-role="task-schedule-permission-full"]')?.checked) {
    permissions.push("full-access");
  }
  if (document.querySelector('[data-role="task-schedule-permission-files"]')?.checked) {
    permissions.push("external-files");
  }
  const kind = document.querySelector('[data-role="task-schedule-kind"]')?.value || "daily";
  const taskKind = document.querySelector('[data-role="task-schedule-task-kind"]')?.value || "poll";
  const goalId = document.querySelector('[data-role="task-schedule-goal"]')?.value || "";
  const tzOffset = -new Date().getTimezoneOffset(); // 东八区 = +480
  const payload = {
    target_session_id: document.querySelector('[data-role="task-schedule-session"]')?.value || activeSessionId || "",
    content: document.querySelector('[data-role="task-schedule-content"]')?.value || "",
    permissions,
    schedule_kind: kind,
    tz_offset_minutes: tzOffset,
    task_kind: taskKind,
    goal_id: taskKind === "goal" ? goalId : null,
  };
  if (kind === "daily" || kind === "weekly") {
    const wall = document.querySelector('[data-role="task-schedule-wall-time"]')?.value || "10:00";
    const parts = wall.split(":");
    payload.wall_hour = Number.parseInt(parts[0], 10) || 0;
    payload.wall_minute = Number.parseInt(parts[1], 10) || 0;
    if (kind === "weekly") {
      payload.weekdays = Array.from(
        document.querySelectorAll('[data-role="task-schedule-weekdays"] input:checked'),
      ).map((el) => Number.parseInt(el.value, 10));
    }
  } else if (kind === "interval") {
    const min = Number.parseInt(document.querySelector('[data-role="task-schedule-interval-min"]')?.value, 10) || 60;
    payload.interval_ms = Math.max(1, min) * 60000;
    payload.run_at_ms = Date.now();
  } else {
    const timeInput = document.querySelector('[data-role="task-schedule-time"]');
    const runAt = timeInput?.value ? new Date(timeInput.value).getTime() : Date.now();
    payload.run_at_ms = Number.isFinite(runAt) ? runAt : Date.now();
  }
  return payload;
}

async function taskScheduleCreate(event) {
  const button = event?.currentTarget || actionButtons.get("task-schedule-create");
  const payload = taskSchedulePayloadFromForm();
  if (!payload.target_session_id || !payload.content.trim()) {
    addMessage({ author: "定时任务", text: "请选择会话并填写任务内容。", kind: "thought", icon: "warn-log" });
    return;
  }
  if (payload.task_kind === "goal" && !payload.goal_id) {
    addMessage({ author: "定时任务", text: "Goal 推进型需选择绑定目标（先在 Goal 模式创建目标）。", kind: "thought", icon: "warn-log" });
    return;
  }
  setBusy(button, true, "Adding");
  try {
    taskScheduleRegistry = await requestJson("/api/task-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const content = document.querySelector('[data-role="task-schedule-content"]');
    if (content) {
      content.value = "";
    }
    taskRenderSchedules(taskScheduleRegistry);
  } catch (error) {
    addMessage({ author: "定时任务", text: `创建失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function taskScheduleRunDue(event) {
  const button = event?.currentTarget || actionButtons.get("task-schedule-run-due");
  setBusy(button, true, "Running");
  try {
    await requestJson("/api/task-schedules/run-due", { method: "POST" });
    await refreshTaskSchedules();
  } catch (error) {
    addMessage({ author: "定时任务", text: `执行失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function taskScheduleHandleListClick(event) {
  const deleteButton = event.target.closest("[data-schedule-delete]");
  if (!deleteButton) {
    return;
  }
  const scheduleId = deleteButton.dataset.scheduleDelete;
  if (!scheduleId) {
    return;
  }
  setBusy(deleteButton, true, "Deleting");
  try {
    taskScheduleRegistry = await requestJson(`/api/task-schedules/${encodeURIComponent(scheduleId)}`, {
      method: "DELETE",
    });
    taskRenderSchedules(taskScheduleRegistry);
  } catch (error) {
    addMessage({ author: "定时任务", text: `删除失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(deleteButton, false);
  }
}

const GOAL_EVENT_NAMES = [
  "goal-created",
  "goal-plan-updated",
  "goal-paused",
  "goal-resumed",
  "goal-cancelled",
  "goal-phase-dispatched",
  "goal-loop-started",
  "goal-loop-stop-requested",
  "goal-loop-stopped",
  "goal-commander-review",
  "goal-role-consultation",
  "goal-role-risk",
  "goal-phase-verification-blocked",
  "goal-phase-verification-attention-required",
  "goal-phase-blocked-needs-replan",
  "goal-phase-replan-escalated",
  "goal-phase-verdict",
  "goal-phase-retry",
  "goal-phase-blocked",
  "goal-phase-unblocked",
  "goal-context-compacted",
  "phase-started",
  "phase-completed",
  "failed",
  "paused",
  "completed",
  "iteration",
];
const GOAL_EVENT_STREAM_LIMIT = 2;
const GOAL_REFRESH_POLL_MS = 2000;
const GOAL_EVENT_STREAM_CLOSED_STATUSES = new Set(["completed", "cancelled", "paused", "failed", "skipped"]);

function goalIsOpen(goal = {}) {
  return Boolean(goal?.id) && !GOAL_EVENT_STREAM_CLOSED_STATUSES.has(String(goal.status || "").toLowerCase());
}

function goalEventStreamCandidates(goals = []) {
  return (goals || [])
    .slice()
    .sort((left, right) => goalUpdatedAt(right) - goalUpdatedAt(left))
    .filter((goal) => goalIsOpen(goal))
    .slice(0, GOAL_EVENT_STREAM_LIMIT);
}

function syncGoalEventSources(goals = []) {
  if (typeof EventSource === "undefined") {
    return;
  }
  const nextIds = new Set(goalEventStreamCandidates(goals).map((goal) => goal.id));
  goalEventSources.forEach((source, goalId) => {
    if (!nextIds.has(goalId)) {
      try { source.close(); } catch { /* ignore */ }
      goalEventSources.delete(goalId);
    }
  });
  nextIds.forEach((goalId) => {
    if (!goalEventSources.has(goalId)) {
      connectGoalEventSource(goalId);
    }
  });
}

function connectGoalEventSource(goalId) {
  const source = new EventSource(`/api/goals/${encodeURIComponent(goalId)}/events`);
  goalEventSources.set(goalId, source);
  GOAL_EVENT_NAMES.forEach((eventName) => {
    source.addEventListener(eventName, (event) => {
      handleGoalEventMessage(goalId, eventName, event);
      scheduleGoalEventRefresh();
    });
  });
  source.addEventListener("lagged", () => scheduleGoalEventRefresh());
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
      goalEventSources.delete(goalId);
    }
  };
}

function handleGoalEventMessage(goalId, eventName, event) {
  const data = parseGoalEventPayload(event);
  const dedupeId = goalEventMessageId(data) || `${goalId}:${eventName}:${data.created_at || ""}:${data.message || ""}`;
  if (seenGoalEventIds.has(dedupeId)) {
    return;
  }
  seenGoalEventIds.add(dedupeId);
  const stage = goalEventMessageText(goalId, eventName, data);
  if (!stage?.text) {
    return;
  }
  if (goalEventShouldFinalize(eventName, data)) {
    finalizeGoalConversation(goalId, data, stage);
    return;
  }
  refreshOpenGoalTaskChain(goalId);
}

function finalizeGoalConversation(goalId, data, stage) {
  removeGoalTransientMessages(goalId);
  addMessage({
    id: `goal-final-${goalId}-${data?.id || Date.now()}`,
    author: goalCommanderAuthor(goalId, data),
    text: goalFinalMessageText(goalId, data, stage),
    kind: "tool-summary",
    icon: "success",
    goalId,
    goalTransient: false,
  });
}

function removeGoalTransientMessages(goalId) {
  const list = chatMessageList();
  if (!list || !goalId) {
    return;
  }
  list
    .querySelectorAll(`[data-goal-id="${CSS.escape(goalId)}"][data-goal-transient="true"]`)
    .forEach((node) => node.remove());
}

function parseGoalEventPayload(event) {
  try {
    return event?.data ? JSON.parse(event.data) : {};
  } catch (error) {
    console.warn("Unable to parse goal event:", error, event?.data);
    return {};
  }
}

function goalEventMessageId(data) {
  return data?.id ? `goal-event-${data.id}` : "";
}

function goalEventMessageKind(eventName) {
  return ["goal-phase-dispatched", "phase-completed", "goal-loop-started", "goal-loop-stopped"].includes(eventName)
    ? "tool-summary"
    : "thought";
}

function goalEventMessageText(goalId, eventName, data = {}) {
  if (eventName === "hello") {
    return null;
  }
  const payload = data.payload || {};
  const role = payload.assigned_role || roleFromPhase(goalId, payload.phase_id) || "commander";
  const target = payload.assigned_session_id ? agentLabel(payload.assigned_session_id) : roleSessionLabel(goalId, role);
  const evidence = payload.evidence ? compactGoalText(payload.evidence, 320) : "";
  const lines = [];
  if (eventName === "goal-created") {
    lines.push("Commander received the user request and recognized a long-running Goal task.");
    lines.push(`Goal: ${goalTitle(goalId)}`);
  } else if (eventName === "goal-role-consultation") {
    lines.push("Commander entered Goal mode and loaded the current role configuration.");
    lines.push(payload.roles_ready ? "Role configuration is ready; task chain can continue." : "Some Goal roles are not configured; user confirmation is required.");
    if (payload.commander_display_name) {
      lines.push(`Commander: ${payload.commander_display_name}`);
    }
  } else if (eventName === "goal-plan-updated") {
    lines.push("Commander updated the task chain for planner / implementer / verifier handoff.");
    lines.push(`Goal: ${goalTitle(goalId)}`);
  } else if (eventName === "goal-loop-started") {
    lines.push("Commander started the Goal execution loop.");
    lines.push(`Progress: ${payload.completed_steps ?? 0}/${payload.max_steps ?? "-"}`);
  } else if (eventName === "goal-phase-dispatched" || eventName === "phase-started") {
    lines.push(`${goalRoleDisplay(role)} received the phase task.`);
    if (payload.phase_id) {
      lines.push(`Phase: ${payload.phase_id}`);
    }
    lines.push(`Session: ${target || "unassigned"}`);
    if (payload.handoff_id) {
      lines.push(`Handoff: ${payload.handoff_id}`);
    }
  } else if (eventName === "phase-completed") {
    lines.push(`${goalRoleDisplay(role)} completed the phase and returned results to Commander.`);
    if (payload.phase_id) {
      lines.push(`Phase: ${payload.phase_id}`);
    }
    if (evidence) {
      lines.push(`Evidence: ${evidence}`);
    }
  } else if (eventName === "goal-commander-review") {
    lines.push("Commander reviewed role availability, dependencies, and task risk.");
    if (data.message) {
      lines.push(compactGoalText(data.message, 220));
    }
  } else if (eventName === "goal-loop-stopped") {
    lines.push(payload.goal_status === "completed" ? "Goal completed; Commander is preparing the final result." : "Goal execution loop stopped.");
    lines.push(`Progress: ${payload.completed_steps ?? 0}/${payload.max_steps ?? "-"}`);
    if (data.message) {
      lines.push(compactGoalText(data.message, 220));
    }
  } else {
    if (data.message) {
      lines.push(compactGoalText(data.message, 240));
    }
  }
  if (!lines.length) {
    return null;
  }
  return {
    author: goalEventAuthor(goalId, eventName, data),
    text: lines.join("\n"),
    kind: goalEventMessageKind(eventName),
    icon: eventName === "phase-completed" ? "success" : "task-list",
  };
}

function goalEventShouldFinalize(eventName, data = {}) {
  const payload = data.payload || {};
  if (eventName !== "goal-loop-stopped") {
    return false;
  }
  const status = String(payload.goal_status || "").toLowerCase();
  return ["completed", "cancelled", "failed", "paused"].includes(status)
    || Boolean(payload.stop_requested)
    || /stop|fail|cancel|pause|interrupt/i.test(String(data.message || ""));
}

function goalEventAuthor(goalId, eventName, data = {}) {
  const payload = data?.payload || {};
  const role = payload.assigned_role || roleFromPhase(goalId, payload.phase_id);
  if (role) {
    return `Goal ${goalRoleDisplay(role)}`;
  }
  return goalCommanderAuthor(goalId, data);
}

function goalCommanderAuthor(goalId, data = {}) {
  const payload = data?.payload || {};
  const commanderId = payload.commander_session_id || goalRoleRegistry.commander_session_id || activeSessionId;
  const label = payload.commander_display_name || (commanderId ? agentLabel(commanderId) : "");
  return label ? `${label} (commander)` : "Goal commander";
}

function goalFinalMessageText(goalId, data = {}, stage = {}) {
  const goal = taskGoals.find((candidate) => candidate.id === goalId);
  const payload = data.payload || {};
  const phases = goal?.phases || [];
  const completed = phases.filter((phase) => phase.status === "completed").length;
  const artifacts = goalArtifacts(goal, payload);
  const status = payload.goal_status || goal?.status || "completed";
  const lines = [
    `Goal summary: ${goal?.title || goalId}`,
    `Status: ${status}; phases: ${completed}/${phases.length || payload.max_steps || "-"}`,
  ];
  if (artifacts.length) {
    lines.push(`Artifacts: ${artifacts.join(", ")}`);
  }
  if (stage?.text) {
    lines.push(compactGoalText(stage.text, 260));
  }
  lines.push("Temporary Goal roles and task-scoped memory have been cleaned up or scheduled for cleanup.");
  return lines.join("\n");
}

function goalArtifacts(goal, payload = {}) {
  const values = new Set();
  (goal?.phases || []).forEach((phase) => {
    (phase.output_artifacts || []).forEach((path) => values.add(path));
  });
  const evidence = String(payload.evidence || goal?.recent_events?.find((event) => event.event_type === "phase-completed")?.payload?.evidence || "");
  for (const match of evidence.matchAll(/(?:^|\s)([A-Za-z]:\\[^\s'"<>]+\.html|[\w./-]+\.html)(?=$|\s|[,.，。])/g)) {
    values.add(match[1]);
  }
  return Array.from(values).filter(Boolean);
}

function goalTitle(goalId) {
  return taskGoals.find((goal) => goal.id === goalId)?.title || goalId;
}

function roleFromPhase(goalId, phaseId) {
  if (!phaseId) {
    return "";
  }
  const goal = taskGoals.find((candidate) => candidate.id === goalId);
  return goal?.phases?.find((phase) => phase.id === phaseId)?.assigned_role || "";
}

function roleSessionLabel(goalId, role) {
  const goal = taskGoals.find((candidate) => candidate.id === goalId);
  const phase = goal?.phases?.find((item) => item.assigned_role === role);
  return phase?.assigned_session_display_name || (phase?.assigned_session_id ? agentLabel(phase.assigned_session_id) : "");
}

function goalRoleDisplay(role) {
  return String(role || "role").replace(/[-_]+/g, " ");
}

function compactGoalText(text, maxLength = 240) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function scheduleGoalEventRefresh() {
  if (goalEventRefreshTimer) {
    return;
  }
  goalEventRefreshTimer = window.setTimeout(() => {
    goalEventRefreshTimer = null;
    refreshGoals();
  }, 300);
}

function syncGoalRefreshPolling(goals = []) {
  if (goalRefreshPollTimer) {
    window.clearTimeout(goalRefreshPollTimer);
    goalRefreshPollTimer = null;
  }
  if (!(goals || []).some((goal) => goalIsOpen(goal))) {
    return;
  }
  goalRefreshPollTimer = window.setTimeout(() => {
    goalRefreshPollTimer = null;
    refreshGoals();
  }, GOAL_REFRESH_POLL_MS);
}

function closeGoalEventSources() {
  goalEventSources.forEach((source) => {
    try { source.close(); } catch { /* ignore */ }
  });
  goalEventSources.clear();
  if (goalEventRefreshTimer) {
    window.clearTimeout(goalEventRefreshTimer);
    goalEventRefreshTimer = null;
  }
  if (goalRefreshPollTimer) {
    window.clearTimeout(goalRefreshPollTimer);
    goalRefreshPollTimer = null;
  }
}

async function refreshProtectedPaths() {
  try {
    const data = await requestJson("/api/tools/protected-paths");
    taskProtectedRules = Array.isArray(data.rules) ? data.rules : [];
    taskRenderProtectedRules(taskProtectedRules);
  } catch (error) {
    taskRenderProtectedRules(taskProtectedRules, error);
  }
}

async function refreshFullAccessStatus() {
  if (!activeChatRoomId) {
    taskFullAccessStatus = { full_access: false, permission_profile: "workspace-write" };
    taskRenderFullAccessStatus(taskFullAccessStatus);
    return;
  }
  try {
    taskFullAccessStatus = await requestJson(`/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/permissions`);
    taskRenderFullAccessStatus(taskFullAccessStatus);
  } catch (error) {
    taskRenderFullAccessStatus({ active: false, error: error.message, ttl_secs_remaining: 0 });
  }
}

function taskRenderFullAccessStatus(status = {}) {
  const active = Boolean(status.full_access || status.permission_profile === "full-access");
  setBindText("tasks.fullAccessStatus", active ? "On · room" : "Off · workspace");
  const roomName = status.room_name || chatRoomRegistry.rooms?.find((item) => item.id === activeChatRoomId)?.name;
  const roomEl = document.querySelector('[data-role="authorization-selected-room"]');
  const scopeEl = document.querySelector('[data-role="authorization-scope"]');
  const riskEl = document.querySelector('[data-role="authorization-risk"]');
  if (roomEl) roomEl.textContent = roomName || "No chat room selected";
  if (scopeEl) scopeEl.textContent = active ? "Full access for this chat room" : "Workspace access for this chat room";
  if (riskEl) {
    riskEl.textContent = active
      ? "Full access is enabled for this chat room and will be restored when the room is selected after restart."
      : "Full access is stored per chat room. Enabling it permits arbitrary commands and file writes for this room.";
  }
  const panel = document.querySelector(".task-full-access");
  panel?.classList.toggle("is-active", active);
  setWorkbenchMotionState("tasks", WORKBENCH_MOTION_STATES.tasks, active);
  const revoke = actionButtons.get("full-access-revoke");
  if (revoke) {
    revoke.disabled = !active;
  }
}

async function enableFullAccessGrant(event) {
  const button = event?.currentTarget || actionButtons.get("full-access-enable");
  if (!activeChatRoomId) {
    addMessage({ author: "Tool permission", text: "Select a chat room before enabling full access.", kind: "thought", icon: "error-log" });
    return;
  }
  const roomName = chatRoomRegistry.rooms?.find((item) => item.id === activeChatRoomId)?.name || activeChatRoomId;
  const ok = window.confirm(`Enable persistent full access for chat room "${roomName}"? This permits arbitrary commands and file writes until revoked.`);
  if (!ok) {
    return;
  }
  const confirmedTwice = window.confirm(`Confirm full access again for chat room "${roomName}". This permission will be restored whenever this room is selected after restart.`);
  if (!confirmedTwice) {
    return;
  }
  setBusy(button, true, "Granting");
  try {
    taskFullAccessStatus = await requestJson(`/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permission_profile: "full-access",
        confirmed_twice: confirmedTwice,
        risk_acknowledged: ok,
      }),
    });
    taskRenderFullAccessStatus(taskFullAccessStatus);
    await refreshToolAudit();
  } catch (error) {
    addMessage({ author: "Tool permission", text: `Full access failed: ${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function revokeFullAccessGrant(event) {
  const button = event?.currentTarget || actionButtons.get("full-access-revoke");
  setBusy(button, true, "Revoking");
  try {
    if (!activeChatRoomId) {
      throw new Error("No active chat room");
    }
    taskFullAccessStatus = await requestJson(`/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission_profile: "workspace-write" }),
    });
    taskRenderFullAccessStatus(taskFullAccessStatus);
    await refreshToolAudit();
  } catch (error) {
    addMessage({ author: "Tool permission", text: `Full access revoke failed: ${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

function taskUpsertApproval(record) {
  if (!record?.call_id) {
    return;
  }
  const index = taskPendingApprovals.findIndex((item) => item.call_id === record.call_id);
  if (index >= 0) {
    taskPendingApprovals.splice(index, 1, record);
  } else {
    taskPendingApprovals.unshift(record);
  }
  taskRenderApprovals(taskPendingApprovals);
}

// 任务卡片审批徽标：仅有待审批工具调用时显示并高亮，否则隐藏（瘦身后的三层结构辅助层）。
function renderTaskCardApprovalBadge(pending = []) {
  const badge = document.querySelector('[data-role="task-summary-approval-badge"]');
  if (!badge) {
    return;
  }
  const count = Array.isArray(pending) ? pending.length : 0;
  badge.hidden = count === 0;
  badge.classList.toggle("is-active", count > 0);
  const label = badge.querySelector('[data-bind="approval.decisionLabel"]');
  if (label && count > 0) {
    const decision = pending[0]?.permission?.decision;
    label.textContent = decision ? String(decision) : "等待";
  }
}

function taskRenderApprovals(pending = []) {
  const list = document.querySelector('[data-role="task-approval-list"]');
  setBindText("tasks.pendingCount", String(pending.length));
  renderTaskCardApprovalBadge(pending);
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (!pending.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "暂无待审批工具调用。";
    list.append(empty);
    return;
  }
  pending.forEach((record) => {
    const item = document.createElement("article");
    item.className = "task-window-approval-item";
    item.dataset.callId = record.call_id || "";
    const perm = record.permission || {};
    const paths = Array.isArray(perm.affected_paths) ? perm.affected_paths.join(", ") : "";
    item.innerHTML = `
      <header>
        <strong>${escapeHtml(record.tool_name || "-")}</strong>
        <span>${escapeHtml(perm.decision || "pending")}</span>
      </header>
      <p>${escapeHtml(record.input_summary || perm.reason || "等待用户授权")}</p>
      <dl>
        <dt>caller</dt><dd>${escapeHtml(record.caller || "-")}</dd>
        <dt>risk</dt><dd>${escapeHtml(perm.risk || perm.required_permission || "-")}</dd>
        <dt>match</dt><dd>${escapeHtml(perm.protected_match || "-")}</dd>
        <dt>paths</dt><dd>${escapeHtml(paths || "-")}</dd>
      </dl>
      <div class="task-window-approval-actions">
        <button type="button" data-approval-action="reject">拒绝</button>
        <button type="button" data-approval-action="approve-once">授权本次</button>
        <button type="button" data-approval-action="approve-session">授权本会话</button>
      </div>
    `;
    list.append(item);
  });
}

function taskRenderProtectedRules(rules = [], error = null) {
  const list = document.querySelector('[data-role="task-protected-rules"]');
  setBindText("tasks.protectedCount", String(rules.length));
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (error) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = `Protected rules load failed: ${error.message}`;
    list.append(empty);
    return;
  }
  if (!rules.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "No protected path rules.";
    list.append(empty);
    return;
  }
  rules.slice(0, 12).forEach((rule) => {
    const item = document.createElement("article");
    item.className = "task-protected-rule";
    item.innerHTML = `
      <strong>${escapeHtml(rule.id || "-")}</strong>
      <code>${escapeHtml(rule.glob || "-")}</code>
      <small>${escapeHtml(rule.access || "any")}</small>
    `;
    list.append(item);
  });
}

function approvalHandleTaskListClick(event) {
  const action = event.target.closest("[data-approval-action]")?.dataset.approvalAction;
  const item = event.target.closest("[data-call-id]");
  if (!action || !item?.dataset.callId) {
    return;
  }
  toolApproval.activeCallId = item.dataset.callId;
  if (action === "reject") {
    respondToApproval("reject");
    return;
  }
  respondToApproval("approve", action === "approve-session" ? "session" : "once");
}

async function taskCreateGoal() {
  const input = document.querySelector('[data-role="goal-consult-title"]');
  const title = input?.value?.trim() || "";
  if (!title) {
    addMessage({ author: "Goal", text: "Goal title is required.", kind: "thought", icon: "task-list" });
    return;
  }
  const button = actionButtons.get("goal-create");
  setBusy(button, true, "Creating");
  try {
    await requestJson("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        chat_room_id: activeChatRoomId,
        max_iterations: 20,
        background: true,
        completion_condition: { type: "UserConfirm" },
      }),
    });
    if (input) {
      input.value = "";
    }
    await refreshGoals();
  } catch (error) {
    addMessage({ author: "Goal", text: `Create failed: ${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function taskHandleGoalListClick(event) {
  const action = event.target.closest("[data-goal-action]")?.dataset.goalAction;
  const item = event.target.closest("[data-goal-id]");
  if (!action || !item?.dataset.goalId) {
    return;
  }
  const button = event.target.closest("button");
  if (action === "task-chain") {
    openGoalTaskChain(item.dataset.goalId);
    return;
  }
  if (action === "cancel") {
    setBusy(button, true, "Canceling");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/cancel`, { method: "POST" });
      await refreshGoals();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal cancel failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (["goal-status", "goal-pause", "goal-resume"].includes(action)) {
    const controls = {
      "goal-status": { path: "/status", method: "GET", label: "Status", busy: "Loading" },
      "goal-pause": { path: "/pause", method: "POST", label: "Pause", busy: "Pausing" },
      "goal-resume": { path: "/resume", method: "POST", label: "Resume", busy: "Resuming" },
    };
    const control = controls[action];
    setBusy(button, true, control.busy);
    try {
      const result = await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}${control.path}`, {
        method: control.method,
      });
      await refreshGoals();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal status action failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "seed-plan") {
    const goal = taskGoals.find((candidate) => candidate.id === item.dataset.goalId);
    setBusy(button, true, "Seeding");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalSeedPlanPayload(goal)),
      });
      await refreshGoals();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal seed plan failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "confirm-roles-plan") {
    const goal = taskGoals.find((candidate) => candidate.id === item.dataset.goalId);
    await confirmGoalRolesAndPlan(goal, button);
    return;
  }
  if (action === "commander-review") {
    setBusy(button, true, "Reviewing");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/commander/review`, {
        method: "POST",
      });
      await refreshGoals();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal commander review failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "dispatch-ready") {
    setBusy(button, true, "Dispatching");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/dispatch-ready`, {
        method: "POST",
      });
      await refreshGoals();
      await refreshHandoffs();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal dispatch failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "run-next") {
    setBusy(button, true, "Running");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/run-next`, {
        method: "POST",
      });
      await refreshGoals();
      await refreshHandoffs();
      await loadGoalRoles();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal run next failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "run-all") {
    setBusy(button, true, "Running");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/run-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_steps: 8 }),
      });
      await refreshGoals();
      await refreshHandoffs();
      await loadGoalRoles();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal run all failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (["loop-start", "loop-stop", "loop-status"].includes(action)) {
    const controls = {
      "loop-start": {
        path: "/loop/start",
        method: "POST",
        label: "Start loop",
        busy: "Starting",
        body: { max_steps: 20 },
      },
      "loop-stop": { path: "/loop/stop", method: "POST", label: "Stop loop", busy: "Stopping" },
      "loop-status": { path: "/loop/status", method: "GET", label: "Loop status", busy: "Loading" },
    };
    const control = controls[action];
    setBusy(button, true, control.busy);
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}${control.path}`, {
        method: control.method,
        headers: control.body ? { "Content-Type": "application/json" } : undefined,
        body: control.body ? JSON.stringify(control.body) : undefined,
      });
      await refreshGoals();
      await refreshHandoffs();
      await loadGoalRoles();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal loop action failed:", error);
    } finally {
      setBusy(button, false);
    }
    return;
  }
  if (action === "phase-complete") {
    const phaseId = event.target.closest("[data-phase-id]")?.dataset.phaseId;
    if (!phaseId) return;
    const goal = taskGoals.find((candidate) => candidate.id === item.dataset.goalId);
    const phase = goal?.phases?.find((candidate) => candidate.id === phaseId);
    const evidence = window.prompt("Completion evidence", phase?.title ? `${phase.title} completed.` : "Phase completed.") || "";
    setBusy(button, true, "Complete");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/phases/${encodeURIComponent(phaseId)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence }),
      });
      await refreshGoals();
      await loadGoalRoles();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal phase completion failed:", error);
    } finally {
      setBusy(button, false);
    }
  }
  if (action === "phase-run") {
    const phaseId = event.target.closest("[data-phase-id]")?.dataset.phaseId;
    if (!phaseId) return;
    setBusy(button, true, "Running");
    try {
      await requestJson(`/api/goals/${encodeURIComponent(item.dataset.goalId)}/phases/${encodeURIComponent(phaseId)}/run`, {
        method: "POST",
      });
      await refreshGoals();
      await refreshHandoffs();
      await loadGoalRoles();
      refreshOpenGoalTaskChain(item.dataset.goalId);
    } catch (error) {
      console.warn("Goal phase run failed:", error);
    } finally {
      setBusy(button, false);
    }
  }
}

function goalSeedPlanPayload(goal) {
  const title = goal?.title || "Goal";
  const outputArtifacts = goalOutputArtifactsForTitle(title);
  const verification = outputArtifacts.length
    ? { type: "FilesExist", paths: outputArtifacts }
    : { type: "UserConfirm" };
  return {
    phases: [
      {
        id: "plan",
        title: `Plan: ${title}`,
        assigned_role: "planner",
        depends_on: [],
        skills_required: ["plan", "decompose"],
        output_artifacts: [],
        verification: { type: "UserConfirm" },
      },
      {
        id: "implement",
        title: `Implement: ${title}`,
        assigned_role: "implementer",
        depends_on: ["plan"],
        skills_required: ["implement", "test"],
        output_artifacts: outputArtifacts,
        verification,
      },
      {
        id: "verify",
        title: `Verify: ${title}`,
        assigned_role: "verifier",
        depends_on: ["implement"],
        skills_required: ["verify"],
        output_artifacts: outputArtifacts,
        verification,
      },
    ],
  };
}

function goalOutputArtifactsForTitle(title) {
  const lower = String(title || "").toLowerCase();
  if (lower.includes("html") || lower.includes("web page") || lower.includes("webpage") || String(title || "").includes("网页")) {
    return [`goal-artifacts/${goalSlug(title)}-goal-output.html`];
  }
  return [];
}

function goalSlug(value) {
  const slug = String(value || "")
    .split("")
    .map((ch) => /[a-z0-9_-]/i.test(ch) ? ch.toLowerCase() : "-")
    .join("")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "task";
}

function goalPhaseRoleTargetText(phase) {
  const role = phase?.assigned_role || "implementer";
  const target = phase?.assigned_session_display_name || phase?.assigned_session_id || "missing goal-role session";
  const state = phase?.assigned_session_available ? "ready" : "missing";
  return `${role} -> ${target} (${state})`;
}

function taskRenderGoals(goals = [], error = null) {
  const host = document.querySelector('[data-role="goal-consult-list"]');
  setBindText("tasks.goalCount", String(goals.length));
  if (!host) {
    return;
  }
  host.replaceChildren();
  syncGoalEventSources(goals);
  if (error) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = `Goals load failed: ${error.message}`;
    host.append(empty);
    return;
  }
  if (!goals.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "No goals yet. Create one to test the G1 contract API.";
    host.append(empty);
    return;
  }
  goals.forEach((goal, index) => {
    const item = document.createElement("article");
    item.className = `task-goal-phase task-goal-item status-${goal.status || "unknown"}`;
    item.dataset.goalId = goal.id || "";
    const event = goal.recent_events?.[0];
    const hasPhases = Boolean(goal.phases?.length);
    const phaseText = goal.phases?.length
      ? `${goal.phases.length} phases`
      : "No phases yet; G1 stores the contract first.";
    const phaseItems = (goal.phases || [])
      .slice(0, 5)
      .map((phase) => {
        const targetClass = phase.assigned_session_available ? "available" : "missing";
        return `
          <li class="task-goal-phase-target ${targetClass}">
            <span>${escapeHtml(phase.status || "-")}</span>
            <strong>${escapeHtml(phase.title || phase.id || "Phase")}</strong>
            <small>${escapeHtml(goalPhaseRoleTargetText(phase))}</small>
            <div class="task-goal-phase-buttons">
              <button type="button" data-goal-action="phase-run" data-phase-id="${escapeHtml(phase.id || "")}" ${phase.status === "running" ? "" : "disabled"}>Run phase</button>
              <button type="button" data-goal-action="phase-complete" data-phase-id="${escapeHtml(phase.id || "")}" ${phase.status === "running" ? "" : "disabled"}>Complete</button>
            </div>
          </li>
        `;
      })
      .join("");
    const terminal = ["completed", "cancelled"].includes(goal.status);
    const paused = goal.status === "paused";
    item.innerHTML = `
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(goal.title || goal.id || "Goal")}</strong>
        <p>${escapeHtml(phaseText)}</p>
        ${phaseItems ? `<ol class="task-goal-phase-list">${phaseItems}</ol>` : ""}
        <small>${escapeHtml(event?.message || goal.id || "")}</small>
      </div>
      <div class="task-goal-actions">
        <small>${escapeHtml(goal.status || "-")} · ${goal.current_iteration || 0}/${goal.max_iterations || 0}</small>
        <button type="button" data-goal-action="task-chain">任务链</button>
        <button type="button" data-goal-action="goal-status">Status</button>
        <button type="button" data-goal-action="goal-pause" ${terminal || paused ? "disabled" : ""}>Pause</button>
        <button type="button" data-goal-action="goal-resume" ${paused ? "" : "disabled"}>Resume</button>
        <button type="button" data-goal-action="seed-plan" ${terminal || hasPhases ? "disabled" : ""}>Seed plan</button>
        <button type="button" data-goal-action="confirm-roles-plan" ${terminal || paused ? "disabled" : ""}>Confirm roles</button>
        <button type="button" data-goal-action="commander-review" ${terminal || paused ? "disabled" : ""}>Review</button>
        <button type="button" data-goal-action="dispatch-ready" ${terminal || paused || !hasPhases ? "disabled" : ""}>Dispatch</button>
        <button type="button" data-goal-action="run-next" ${terminal || paused || !hasPhases ? "disabled" : ""}>Run next</button>
        <button type="button" data-goal-action="run-all" ${terminal || paused || !hasPhases ? "disabled" : ""}>Run all</button>
        <button type="button" data-goal-action="loop-start" ${terminal || paused || !hasPhases ? "disabled" : ""}>Start loop</button>
        <button type="button" data-goal-action="loop-stop" ${!hasPhases ? "disabled" : ""}>Stop loop</button>
        <button type="button" data-goal-action="loop-status" ${!hasPhases ? "disabled" : ""}>Loop status</button>
        <button type="button" data-goal-action="cancel" ${terminal ? "disabled" : ""}>Cancel</button>
      </div>
    `;
    host.append(item);
  });
}

// 任务链弹层顶部摘要头：承载从任务卡片迁出的摘要 / Success Rate / todo 清单 / 计划数。
// 弹层是打开即快照的模式（refreshOpenGoalTaskChain 靠整体重建刷新），此处按当前状态计算一次即可，
// 数据口径与任务卡片一致（taskCardVisibleGoals + mergedRuntimeTaskItems）。
function taskChainSummaryHeadHtml({ goal = null, runtimeTask = null } = {}) {
  const runtimeItems = mergedRuntimeTaskItems();
  const visibleGoals = taskCardVisibleGoals(taskGoals, runtimeItems);
  const summaryGoal = goal || selectTaskCardGoal(visibleGoals);
  const summaryText = runtimeTask
    ? taskCardSummaryText({ runtimeTask })
    : taskCardSummaryText({ activeGoal: summaryGoal });
  const snapshot = taskStatusSnapshot(visibleGoals, runtimeItems);
  const todoItems = collectTaskTodoItems(visibleGoals, runtimeItems).slice(0, 6);
  const scheduleDue = Number(taskScheduleRegistry?.due_count || 0);

  const todoRows = todoItems.length
    ? todoItems
        .map((item) => {
          const meta = taskTodoStatusMeta(item.status);
          const badge = meta.retry > 0 && meta.cls === "failed" ? `失败重试${item.retry}` : meta.label;
          return `
            <li class="task-todo-item">
              <span class="task-todo-name" title="${escapeHtml(item.title || item.name || "")}">${escapeHtml(item.name)}</span>
              <em class="task-todo-badge ${meta.cls}">${escapeHtml(badge)}</em>
              <b class="task-todo-time">${escapeHtml(taskTodoTimeText(item))}</b>
            </li>`;
        })
        .join("")
    : '<li class="task-todo-empty">暂无进行中的任务</li>';

  return `
    <li class="task-chain-summary-head">
      <p class="task-chain-summary-line"><span>摘要</span><b>${escapeHtml(summaryText || "暂无摘要")}</b></p>
      <div class="task-chain-summary-rate">
        <span>Success Rate</span>
        <div class="task-success-rate-track" aria-hidden="true"><i data-role="task-chain-summary-rate-bar" style="width:${snapshot.successRate}%"></i></div>
        <b>${snapshot.successRate}%</b>
      </div>
      <ul class="task-todo-list task-chain-summary-todo">${todoRows}</ul>
      <p class="task-chain-summary-plan"><span>计划</span><b>${scheduleDue} 项待办</b></p>
    </li>
  `;
}

function openGoalTaskChain(goalId) {
  document.querySelector(".task-chain-modal")?.remove();
  const goal = taskGoals.find((candidate) => candidate.id === goalId);
  const modal = document.createElement("div");
  modal.className = "task-chain-modal";
  modal.dataset.goalId = goalId || "";
  modal.innerHTML = `
    <div class="task-chain-dialog" role="dialog" aria-modal="true" aria-label="Goal task chain">
      <header>
        <div>
          <strong>任务链</strong>
          <span>${escapeHtml(goal?.title || goalId || "Goal")}</span>
        </div>
        <button type="button" data-task-chain-close aria-label="Close">×</button>
      </header>
      <ol class="task-chain-list">
        ${taskChainSummaryHeadHtml({ goal })}
        ${goalTaskChainRows(goal).join("")}
      </ol>
    </div>
  `;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-task-chain-close]")) {
      modal.remove();
    }
  });
  document.body.append(modal);
}

function refreshOpenGoalTaskChain(goalId = null) {
  const modal = document.querySelector(".task-chain-modal");
  if (!modal) {
    return;
  }
  const openGoalId = modal.dataset.goalId || "";
  if (!openGoalId || (goalId && openGoalId !== goalId)) {
    return;
  }
  openGoalTaskChain(openGoalId);
}

function openCurrentTaskChain() {
  const visibleGoals = taskCardVisibleGoals(taskGoals, mergedRuntimeTaskItems());
  const activeGoal = selectTaskCardGoal(visibleGoals);
  if (activeGoal?.id) {
    openGoalTaskChain(activeGoal.id);
    return;
  }
  const runtimeTask = mergedRuntimeTaskItems()[0] || realtimeSessionRuntimeTask;
  openRuntimeTaskChain(runtimeTask);
}

function openRuntimeTaskChain(runtimeTask = null) {
  document.querySelector(".task-chain-modal")?.remove();
  const modal = document.createElement("div");
  modal.className = "task-chain-modal";
  modal.dataset.runtimeTaskId = runtimeTask?.id || "";
  const title = runtimeTask?.executor_agent || runtimeTask?.owner_agent || "运行任务";
  modal.innerHTML = `
    <div class="task-chain-dialog" role="dialog" aria-modal="true" aria-label="Runtime task chain">
      <header>
        <div>
          <strong>任务链</strong>
          <span>${escapeHtml(title)}</span>
        </div>
        <button type="button" data-task-chain-close aria-label="Close">×</button>
      </header>
      <ol class="task-chain-list">
        ${taskChainSummaryHeadHtml({ runtimeTask })}
        ${runtimeTaskChainRows(runtimeTask).join("")}
      </ol>
    </div>
  `;
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-task-chain-close]")) {
      modal.remove();
    }
  });
  document.body.append(modal);
}

// 任务链阶段状态 → 状态灯类名 + 中文标签
const TASK_CHAIN_PHASE_STATUS = {
  completed: { cls: "done", label: "已完成" },
  running: { cls: "running", label: "执行中" },
  pending: { cls: "pending", label: "待执行" },
  failed: { cls: "failed", label: "失败/阻塞" },
  rejected: { cls: "failed", label: "校验未过" },
  blocked: { cls: "failed", label: "已阻塞" },
  cancelled: { cls: "muted", label: "已取消" },
  skipped: { cls: "muted", label: "已跳过" },
};
function taskChainPhaseStatusMeta(status) {
  return TASK_CHAIN_PHASE_STATUS[String(status || "").toLowerCase()] || { cls: "pending", label: status || "待执行" };
}
function goalTaskChainProgress(goal) {
  const phases = Array.isArray(goal?.phases) ? goal.phases : [];
  if (!phases.length) {
    return { percent: goal?.status === "completed" ? 100 : 0, done: 0, total: 0 };
  }
  const done = phases.filter((phase) => phase.status === "completed").length;
  return { percent: Math.round((done / phases.length) * 100), done, total: phases.length };
}

function goalTaskChainRows(goal) {
  if (!goal) {
    return ['<li><strong>Goal</strong><p>Goal not found.</p></li>'];
  }
  const rows = [];
  const progress = goalTaskChainProgress(goal);
  // 顶部总进度条
  rows.push(`
    <li class="task-chain-progress-row">
      <strong>总进度</strong>
      <div class="task-chain-progress-bar"><span style="width:${progress.percent}%"></span></div>
      <small>${progress.percent}% · ${progress.done}/${progress.total} 阶段完成 · 状态 ${escapeHtml(goal.status || "planning")}</small>
    </li>
  `);
  rows.push(`
    <li class="task-chain-node is-commander">
      <span class="task-chain-dot done"></span>
      <strong>指挥官 Commander</strong>
      <p>${escapeHtml(goal.title || goal.id || "Goal")}</p>
      <small>${escapeHtml(goal.recent_events?.[0]?.message || "等待任务事件…")}</small>
    </li>
  `);
  (goal.phases || []).forEach((phase, index) => {
    const meta = taskChainPhaseStatusMeta(phase.status);
    rows.push(`
      <li class="task-chain-node">
        <span class="task-chain-dot ${meta.cls}"></span>
        <strong>${index + 1}. ${escapeHtml(goalRoleDisplay(phase.assigned_role || "role"))}</strong>
        <p>${escapeHtml(phase.title || phase.id || "Phase")} <em class="task-chain-status-tag ${meta.cls}">${escapeHtml(meta.label)}</em></p>
        <small>${escapeHtml(goalPhaseRoleTargetText(phase))}</small>
      </li>
    `);
  });
  // 近期事件（执行进度细节）
  const events = (goal.recent_events || []).slice(0, 8);
  if (events.length) {
    rows.push('<li class="task-chain-events-head"><strong>执行进度事件</strong></li>');
  }
  events.forEach((event) => {
    const detail = goalTaskChainEventDetail(event);
    rows.push(`
      <li class="task-chain-event">
        <span class="task-chain-dot ${taskChainEventDotClass(event.event_type)}"></span>
        <strong>${escapeHtml(taskChainEventLabel(event.event_type))}</strong>
        <p>${escapeHtml(compactGoalText(event.message || detail || "", 180))}</p>
        <small>${escapeHtml(compactGoalText(detail || "", 220))}</small>
      </li>
    `);
  });
  return rows;
}

function runtimeVisionTaskChainDetails(status = {}) {
  const vision = visionRealtimeLastStatus || {};
  const resourceSwitch = status.resource_switch || vision.resource_switch || {};
  const resourceParts = [
    resourceSwitch.mode || null,
    resourceSwitch.active_profile ? `profile=${resourceSwitch.active_profile}` : null,
    resourceSwitch.showui_state ? `ShowUI=${resourceSwitch.showui_state}` : null,
    resourceSwitch.uidetr_state ? `UI-DETR=${resourceSwitch.uidetr_state}` : null,
  ].filter(Boolean);
  return [
    `frames=${status.vision_frames_processed || vision.frames_processed || 0}`,
    `elements=${status.vision_element_count || vision.element_count || 0}`,
    `Detector backend=${status.detection_backend || vision.detection_backend || "-"}`,
    `Detection model=${status.detection_model || vision.detection_model || "-"}`,
    `Detection endpoint=${status.detection_base_url || vision.detection_base_url || "(not configured)"}`,
    `Detection service=${(status.detection_service_reachable ?? vision.detection_service_reachable) ? "reachable" : "offline"}`,
    `Detection model path=${status.detection_model_path || vision.detection_model_path || "(not configured)"}; exists=${(status.detection_model_path_exists ?? vision.detection_model_path_exists) ? "yes" : "no"}`,
    `Detection launcher=${status.detection_launcher_hint || vision.detection_launcher_hint || "-"}`,
    `Vision resource switch=${resourceParts.join(", ") || "-"}`,
  ].join("; ");
}

function runtimeAudioOutputTaskChainDetails(status = {}) {
  const ttsMissing = status.tts_available === false;
  const backend = status.tts_backend || "unknown";
  const indexBaseUrl = status.index_tts_base_url || "";
  const streamingTtsUrl = status.streaming_tts_url || "";
  const streamingTtsConfigured = Boolean(status.streaming_tts_url_configured || streamingTtsUrl);
  const ttsTransport = status.tts_transport || status.streaming_risk?.tts_transport || "segmented_tts_queue";
  const ttsProbe = status.last_streaming_tts_probe || null;
  const ttsProbeState = ttsProbe
    ? `${ttsProbe.chunk_received ? "chunk-ok" : (ttsProbe.reachable ? "reachable-no-chunk" : "offline")}${ttsProbe.bytes ? `:${ttsProbe.bytes}B` : ""}`
    : "not-run";
  const indexState = status.index_tts_available
    ? "available"
    : (indexBaseUrl ? "configured-unreachable" : "not-configured");
  const nextAction = ttsMissing
    ? "Use fallback TTS for realtime replies or configure a reachable IndexTTS endpoint"
    : (ttsTransport === "chunked_tts_stream" && !streamingTtsConfigured
      ? "Configure audio.realtime.streaming_tts_url for true streaming TTS"
    : (status.index_tts_available
      ? "Use IndexTTS for realtime final replies"
      : (indexBaseUrl ? "Check IndexTTS endpoint health" : "Configure IndexTTS base_url")));
  return [
    `tts=${ttsMissing ? "missing" : "available"}`,
    `backend=${backend}`,
    `transport=${ttsTransport}`,
    `index_tts=${indexState}`,
    `IndexTTS endpoint=${indexBaseUrl || "(not configured)"}`,
    `streaming_tts=${streamingTtsConfigured ? "configured" : "not-configured"}`,
    `Streaming TTS endpoint=${streamingTtsUrl || "(not configured)"}`,
    `Streaming TTS timeout=${status.streaming_tts_timeout_seconds || 30}s`,
    `Streaming TTS probe=${ttsProbeState}`,
    `Streaming TTS probe error=${compactGoalText(ttsProbe?.error || "", 120) || "-"}`,
    `source=${status.last_tts_source || "-"}`,
    `playback=${status.audio_out_state || "idle"}`,
    `segments=${status.last_tts_played || 0}/${status.last_tts_segment_count || 0}`,
    `duration_ms=${status.last_tts_duration_ms || "-"}`,
    `next=${nextAction}`,
  ].join("; ");
}

function runtimeTaskChainRows(task = null) {
  if (!task) {
    return ['<li><strong>运行任务</strong><p>暂无可展示的运行任务链。</p></li>'];
  }
  const gates = Array.isArray(task.readiness_gates) ? task.readiness_gates : [];
  const readyGateCount = gates.filter((gate) => gate?.ready).length;
  const percent = gates.length ? Math.round((readyGateCount / gates.length) * 100) : 0;
  const statusMeta = taskChainPhaseStatusMeta(runtimeTaskTodoStatus(task));
  const rows = [];
  rows.push(`
    <li class="task-chain-progress-row">
      <strong>总进度</strong>
      <div class="task-chain-progress-bar"><span style="width:${percent}%"></span></div>
      <small>${percent}% · ${readyGateCount}/${gates.length || 0} full-streaming gates ready · ${escapeHtml(task.status || "running")}</small>
    </li>
  `);
  rows.push(`
    <li class="task-chain-node is-commander">
      <span class="task-chain-dot ${statusMeta.cls}"></span>
      <strong>Realtime session commander</strong>
      <p>${escapeHtml(task.executor_agent || task.owner_agent || "Runtime task")} <em class="task-chain-status-tag ${statusMeta.cls}">${escapeHtml(statusMeta.label)}</em></p>
      <small>${escapeHtml(compactGoalText(task.summary || "", 220))}</small>
    </li>
  `);
  const status = realtimeSessionStatus || {};
  const modelProbe = status.last_model_stream_probe || null;
  const modelProbeDetail = modelProbe
    ? `model_probe=${modelProbe.ok ? "delta-ok" : "failed"}; delta_count=${modelProbe.delta_count || 0}; first_delta_ms=${modelProbe.first_delta_ms ?? "-"}; evidence=${modelProbe.runtime_evidence_recorded ? "recorded" : "not-recorded"}; error=${compactGoalText(modelProbe.error || "", 120) || "-"}`
    : "model_probe=not-run";
  const substates = [
    ["Vision loop", status.vision_state || "off", runtimeVisionTaskChainDetails(status)],
    [
      "Audio input loop",
      status.audio_in_state || "off",
      `segments=${status.audio_segments_received || 0}; bytes=${status.audio_bytes_received || 0}; payload_chunks=${status.audio_payload_chunks_received || 0}; last_payload=${status.last_audio_payload_bytes || 0}; partial=${status.partial_transcripts_received || 0}; partial_provider=${status.partial_asr_provider || "none"}; last_asr_text=${compactGoalText(status.last_partial_text || "", 120) || "-"}`,
    ],
    [
      "Assistant stream",
      status.reasoning_state || "idle",
      `agent=${status.last_assistant_agent || "-"}; text=${compactGoalText(status.last_assistant_text || "", 120) || "-"}; ${modelProbeDetail}`,
    ],
    [
      "Action loop",
      status.last_action_status || "idle",
      `tool=${status.last_action_tool || "-"}; summary=${compactGoalText(status.last_action_summary || "", 120) || "-"}`,
    ],
    ["Audio output loop", status.audio_out_state || "idle", runtimeAudioOutputTaskChainDetails(status)],
    [
      "Barge-in guard",
      status.barge_in_state || "quiet",
      `mode=${status.active_mode || "half_duplex_guarded"}; risk=${status.streaming_risk?.risk_level || "unknown"}; decision=${status.last_barge_in_decision || "-"}; reason=${compactGoalText(status.last_barge_in_reason || "", 120) || "-"}`,
    ],
  ];
  substates.forEach(([label, state, detail], index) => {
    const active = ["running", "listening", "speaking", "confirmed", "degraded", "warming"].some((needle) =>
      String(state || "").toLowerCase().includes(needle),
    );
    const meta = active ? taskChainPhaseStatusMeta("running") : taskChainPhaseStatusMeta("pending");
    rows.push(`
      <li class="task-chain-node">
        <span class="task-chain-dot ${meta.cls}"></span>
        <strong>${index + 1}. ${escapeHtml(label)}</strong>
        <p>${escapeHtml(String(state || "-"))} <em class="task-chain-status-tag ${meta.cls}">${escapeHtml(meta.label)}</em></p>
        <small>${escapeHtml(detail)}</small>
      </li>
    `);
  });
  if (gates.length) {
    rows.push('<li class="task-chain-events-head"><strong>Full streaming readiness gates</strong></li>');
  }
  gates.forEach((gate) => {
    const meta = taskChainPhaseStatusMeta(gate.ready ? "completed" : "pending");
    const label = realtimeReadinessGateLabel(gate);
    rows.push(`
      <li class="task-chain-event">
        <span class="task-chain-dot ${meta.cls}"></span>
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(gate.ready ? "ready" : "not ready")} <em class="task-chain-status-tag ${meta.cls}">${escapeHtml(meta.label)}</em></p>
        <small>${escapeHtml(gate.reason || "")}</small>
      </li>
    `);
  });
  return rows;
}

// 事件类型 → 状态灯颜色
function taskChainEventDotClass(eventType) {
  const t = String(eventType || "").toLowerCase();
  if (t.includes("completed") || t === "completed") return "done";
  if (t.includes("blocked") || t.includes("rejected") || t.includes("failed") || t.includes("escalat") || t.includes("attention")) return "failed";
  if (t.includes("dispatched") || t.includes("started") || t.includes("loop")) return "running";
  if (t.includes("paused") || t.includes("cancel")) return "muted";
  return "pending";
}
// 事件类型 → 中文标签
function taskChainEventLabel(eventType) {
  const map = {
    "goal-created": "目标创建",
    "goal-plan-updated": "计划更新",
    "goal-phase-dispatched": "阶段派发",
    "phase-started": "阶段开始",
    "phase-completed": "阶段完成",
    "goal-loop-started": "循环开始",
    "goal-loop-stopped": "循环停止",
    "goal-commander-review": "指挥官审视",
    "goal-phase-verification-blocked": "校验未过·回退实现者",
    "goal-phase-verification-attention-required": "需人工介入",
    "goal-phase-blocked-needs-replan": "受阻·回退规划者",
    "goal-phase-replan-escalated": "重规划升级",
    "goal-phase-verdict": "校验结论",
    "goal-phase-retry": "重试·回退修复",
    "goal-phase-blocked": "超重试上限·受阻暂停",
    "goal-phase-unblocked": "重规划解阻·预算重置",
    "goal-paused": "已暂停",
    "goal-resumed": "已恢复",
    "goal-cancelled": "已取消",
  };
  return map[String(eventType || "").toLowerCase()] || eventType || "事件";
}

function goalTaskChainEventDetail(event = {}) {
  const payload = event.payload || {};
  const parts = [];
  if (payload.phase_id) parts.push(`phase=${payload.phase_id}`);
  if (payload.assigned_role) parts.push(`role=${payload.assigned_role}`);
  if (payload.assigned_session_id) parts.push(`session=${agentLabel(payload.assigned_session_id) || payload.assigned_session_id}`);
  if (payload.handoff_id) parts.push(`handoff=${payload.handoff_id}`);
  if (payload.goal_status) parts.push(`status=${payload.goal_status}`);
  if (payload.completed_steps !== undefined || payload.max_steps !== undefined) {
    parts.push(`progress=${payload.completed_steps ?? 0}/${payload.max_steps ?? "-"}`);
  }
  if (payload.stop_requested) parts.push("stop_requested=true");
  if (payload.evidence) parts.push(`evidence=${compactGoalText(payload.evidence, 180)}`);
  if (Array.isArray(payload.missing_artifacts) && payload.missing_artifacts.length) {
    parts.push(`missing=${payload.missing_artifacts.join(", ")}`);
  }
  return parts.join("; ") || event.message || "";
}

function taskRenderGoalPlaceholder() {
  const host = document.querySelector('[data-role="goal-consult-list"]');
  setBindText("tasks.goalCount", "0");
  if (!host) {
    return;
  }
  host.replaceChildren();
  const phases = [
    ["REQ-GOAL-001", "Goal 契约 / SQLite / CRUD"],
    ["REQ-GOAL-002", "CompletionCondition DSL 走 runtime 权限"],
    ["REQ-GOAL-003", "GoalPlan / Phase DAG / 验证条件"],
    ["REQ-GOAL-006", "Goal Loop 复用 handoff 与 tool runtime"],
  ];
  phases.forEach(([id, text], index) => {
    const item = document.createElement("article");
    item.className = "task-goal-phase";
    item.innerHTML = `
      <span>${index + 1}</span>
      <div><strong>${escapeHtml(id)}</strong><p>${escapeHtml(text)}</p></div>
      <small>待开发</small>
    `;
    host.append(item);
  });
}

function taskRenderHandoffSummary(handoffs = []) {
  const list = document.querySelector('[data-role="task-handoff-list"]');
  setBindText("tasks.handoffCount", String(handoffs.length));
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (!handoffs.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "暂无任务链。";
    list.append(empty);
    return;
  }
  handoffs.slice(0, 8).forEach((handoff) => {
    const item = document.createElement("article");
    item.className = `task-handoff-item is-${handoff.status || "unknown"}`;
    item.innerHTML = `
      <strong>${escapeHtml(agentLabel(handoff.from_agent_id))} -> ${escapeHtml(agentLabel(handoff.to_agent_id))}</strong>
      <p>${escapeHtml(handoff.intent || "")}</p>
      <small>${escapeHtml(handoff.status || "-")} / depth ${handoff.depth ?? 0}</small>
    `;
    list.append(item);
  });
}

function taskRenderGoalRoleRisks(roles = [], error = null) {
  const list = document.querySelector('[data-role="task-role-risk-list"]');
  const risky = Array.isArray(roles)
    ? roles.filter((role) => role?.risk_level && role.risk_level !== "normal")
    : [];
  setBindText("tasks.roleRiskCount", String(risky.length));
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (error) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = `Role risks load failed: ${error.message}`;
    list.append(empty);
    return;
  }
  if (!risky.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "暂无角色风险。";
    list.append(empty);
    return;
  }
  risky.slice(0, 8).forEach((role) => {
    const item = document.createElement("article");
    item.className = `task-role-risk-item is-${role.risk_level || "unknown"}`;
    const status = role.stuck ? "stuck" : role.online ? "online" : "offline";
    item.innerHTML = `
      <strong>${escapeHtml(role.display_name || role.session_id || "-")}</strong>
      <p>${escapeHtml(role.role || "unassigned")} / ${escapeHtml(role.risk_level || "-")}</p>
      <small>${escapeHtml(status)} · heartbeat ${escapeHtml(String(role.heartbeat_timeout_ms || 0))}ms · task ${escapeHtml(String(role.task_timeout_ms || 0))}ms</small>
    `;
    list.append(item);
  });
}

function renderOverviewActiveRoles(roles = []) {
  const host = document.querySelector('[data-role="overview-active-roles"]');
  const activeRoles = (Array.isArray(roles) ? roles : []).filter((role) => role?.active_task_started_at);
  setBindText("overview.activeRoleCount", String(activeRoles.length));
  if (!host) {
    return;
  }
  host.replaceChildren();
  if (!activeRoles.length) {
    host.textContent = "暂无激活 goal roles。";
    return;
  }
  activeRoles.slice(0, 12).forEach((role) => {
    const chip = document.createElement("span");
    chip.className = `overview-role-chip is-${role.risk_level || "normal"}`;
    chip.textContent = `${role.role || "role"}: ${role.display_name || role.session_id || "-"}`;
    chip.title = [
      role.responsibility,
      role.online ? "online" : "offline",
      role.risk_level || "normal",
    ].filter(Boolean).join(" / ");
    host.append(chip);
  });
}

function agentHealthSnapshot(registry = agentRegistry) {
  const agents = (Array.isArray(registry?.agents) ? registry.agents : [])
    .filter((agent) => agent?.selectable && !agent?.system);
  const activeIds = new Set(Array.isArray(registry?.active_agent_ids) ? registry.active_agent_ids : []);
  const unavailablePattern = /(missing|invalid|error|failed|未配置|无效|失败|错误)/i;
  const ready = agents.filter((agent) => {
    const keyStatus = String(agent.api_key_status || "").trim();
    return agent.enabled !== false && !unavailablePattern.test(keyStatus);
  }).length;
  const active = agents.filter((agent) => activeIds.has(agent.id)).length;
  const total = agents.length;
  const percent = total ? Math.round((ready / total) * 100) : 0;
  const tone = total === 0 ? "idle" : percent >= 80 ? "good" : percent >= 50 ? "warn" : "critical";
  return { total, ready, active, percent, tone };
}

function renderOverviewHealth(registry = agentRegistry) {
  const snapshot = agentHealthSnapshot(registry);
  setBindText("overview.healthPercent", `${snapshot.percent}%`);
  setBindText("overview.healthDetail", `${snapshot.ready}/${snapshot.total} ready · ${snapshot.active} active`);
  const host = document.querySelector('[data-role="overview-health"]');
  const bar = document.querySelector('[data-role="overview-health-bar"]');
  if (bar) {
    bar.style.width = `${snapshot.percent}%`;
  }
  if (host) {
    host.classList.toggle("is-good", snapshot.tone === "good");
    host.classList.toggle("is-warn", snapshot.tone === "warn");
    host.classList.toggle("is-critical", snapshot.tone === "critical");
    host.classList.toggle("is-idle", snapshot.tone === "idle");
  }
}

function renderOverviewMascot() {
  const image = document.querySelector('[data-role="overview-mascot-avatar"]');
  if (!image) {
    return;
  }
  const agents = Array.isArray(agentRegistry?.agents) ? agentRegistry.agents : [];
  const activeIds = new Set(Array.isArray(agentRegistry?.active_agent_ids) ? agentRegistry.active_agent_ids : []);
  const agent = agents.find((candidate) => activeIds.has(candidate.id))
    || sessionById(activeSessionId)
    || agents.find((candidate) => candidate?.selectable)
    || null;
  const configuredAvatar = avatarForSession(agent);
  const fallbackAvatar = avatarManifest.length
    ? avatarPathFromFile(avatarManifest[0].file)
    : DEFAULT_WUXIA_AVATAR_PATH;
  const avatar = configuredAvatar || fallbackAvatar;
  image.src = avatarUrl(avatar);
  image.title = agent?.display_name || agent?.name || "Agent overview";
  image.closest(".overview-mascot")?.style.setProperty("--avatar-theme", avatarThemeForPath(avatar));
}

function goalUpdatedAt(goal = {}) {
  return Number(goal.updated_at || goal.updatedAt || goal.created_at || goal.createdAt || 0);
}

const TASK_CARD_OPEN_GOAL_STATUSES = new Set(["created", "planning", "planned", "pending", "running", "in_progress", "blocked"]);
// 任务卡片只反映最近活跃的 goal：超过此时长未更新的视为遗留 / 中断任务，不再占用任务卡片。
const TASK_CARD_GOAL_MAX_AGE_MS = 30 * 60 * 1000;

function goalIsCurrentTaskCardCandidate(goal = {}) {
  const status = String(goal.status || "").toLowerCase();
  if (!TASK_CARD_OPEN_GOAL_STATUSES.has(status)) {
    return false;
  }
  // 不显示遗留之前的中断任务：仅最近 N 分钟内更新过的 goal 才进任务卡片。
  const updated = goalUpdatedAt(goal);
  if (updated > 0 && Date.now() - updated > TASK_CARD_GOAL_MAX_AGE_MS) {
    return false;
  }
  return true;
}

function taskCardVisibleGoals(goals = [], runtimeTasks = taskRuntimeItems) {
  if (Array.isArray(runtimeTasks) && runtimeTasks.length) {
    return [];
  }
  const ordered = (Array.isArray(goals) ? goals : [])
    .filter((goal) => Boolean(goal?.id))
    .filter(goalIsCurrentTaskCardCandidate)
    .slice()
    .sort((left, right) => goalUpdatedAt(right) - goalUpdatedAt(left));
  if (ordered.length) {
    return [ordered[0]];
  }
  return [];
}

function visionRealtimeTaskItem(status = {}) {
  const hasDetectorConfig = Boolean(
    status.detection_backend || status.detection_model || status.detection_base_url || status.detection_launcher_hint,
  );
  const loopActive = Boolean(status.loop_running || status.loop_requested);
  const resourceIssue = status.detection_service_reachable === false || status.detection_model_path_exists === false;
  if (!hasDetectorConfig || (!loopActive && !resourceIssue)) {
    return null;
  }
  const states = [
    `state=${status.active_loop || status.status || "reserved"}`,
    `backend=${status.detection_backend || "-"}`,
    `model=${status.detection_model || "-"}`,
    `endpoint=${status.detection_base_url || "(not configured)"}`,
    status.detection_service_reachable ? "service=reachable" : "service=offline",
    status.detection_model_path_exists ? "model_path=exists" : "model_path=missing",
    `frames=${status.frames_processed || 0}`,
    `elements=${status.element_count || 0}`,
  ];
  if (status.detection_launcher_hint) {
    states.push(`launcher=${status.detection_launcher_hint}`);
  }
  return {
    id: "runtime-vision-realtime",
    owner_agent: "vision-realtime",
    executor_agent: "Realtime vision detector",
    status: loopActive ? "running" : (resourceIssue ? "failed" : "pending"),
    summary: states.join(" / "),
    readiness_gates: [],
    startedAt: Number(status.started_at_ms || status.last_frame_ms || Date.now()),
    timeout_ms: 0,
  };
}

function syncVisionRealtimeTask(status = visionRealtimeLastStatus) {
  visionRealtimeRuntimeTask = visionRealtimeTaskItem(status);
  syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
}

function mergedRuntimeTaskItems() {
  return [
    ...(Array.isArray(taskRuntimeItems) ? taskRuntimeItems : []),
    realtimeSessionRuntimeTask,
    visionRealtimeRuntimeTask,
    ...videoRuntimeTasks.values(),
  ].filter(Boolean);
}

// 视频生成任务进度/状态变化后刷新任务卡片（复用 goal / runtime 任务卡片渲染）。
function refreshVideoTaskCard() {
  syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
}

function realtimeSessionTaskItem(status = {}) {
  if (!status?.running) {
    return null;
  }
  const startedAt = Number(status.started_at_ms || Date.now());
  const ttsAvailable = status.tts_available !== false;
  const ttsStateLabel = ttsAvailable ? "tts=available" : "tts=missing";
  const streamingTtsConfigured = Boolean(status.streaming_tts_url_configured || status.streaming_tts_url);
  const streamingTtsProbe = status.last_streaming_tts_probe || null;
  const streamingTtsProbeLabel = streamingTtsProbe
    ? (streamingTtsProbe.chunk_received ? "chunk_ok" : (streamingTtsProbe.reachable ? "reachable_no_chunk" : "offline"))
    : "not_run";
  const modelStreamProbe = status.last_model_stream_probe || null;
  const modelStreamProbeLabel = modelStreamProbe
    ? (modelStreamProbe.ok ? `delta_ok:${modelStreamProbe.delta_count || 0}` : "failed")
    : "not_run";
  const activeMode = status.active_mode || status.streaming_risk?.recommended_mode || "half_duplex_guarded";
  const modeStateLabel = activeMode === "half_duplex_guarded" ? "mode=half_duplex_guarded" : `mode=${activeMode}`;
  const riskLevel = status.streaming_risk?.risk_level || "unknown";
  const riskStateLabel = riskLevel === "guarded" ? "risk=guarded" : `risk=${riskLevel}`;
  const gates = Array.isArray(status.streaming_risk?.readiness_gates)
    ? status.streaming_risk.readiness_gates
    : [];
  const readyGateCount = gates.filter((gate) => gate?.ready).length;
  const gateStateLabel = gates.length ? `gates=${readyGateCount}/${gates.length}` : "gates=0/0";
  const states = [
    `state=${status.main_state || "idle"}`,
    modeStateLabel,
    `vision=${status.vision_state || "off"}`,
    `detector=${status.detection_service_reachable === false ? "offline" : (status.detection_service_reachable ? "reachable" : "unknown")}`,
    `detector_model_path=${status.detection_model_path_exists ? "exists" : "missing"}`,
    `audio=${status.audio_in_state || "off"}`,
    `segments=${status.audio_segments_received || 0}`,
    `bytes=${status.audio_bytes_received || 0}`,
    `payload_chunks=${status.audio_payload_chunks_received || 0}`,
    `last_payload=${status.last_audio_payload_bytes || 0}`,
    `partial=${status.partial_transcripts_received || 0}`,
    `partial_conf=${status.last_partial_confidence ?? "-"}`,
    `partial_provider=${status.partial_asr_provider || "none"}`,
    `last_asr_text=${compactGoalText(status.last_partial_text || "", 90) || "-"}`,
    `assistant=${status.reasoning_state || "idle"}`,
    `assistant_agent=${status.last_assistant_agent || "-"}`,
    `assistant_text=${compactGoalText(status.last_assistant_text || "", 90) || "-"}`,
    `model_probe=${modelStreamProbeLabel}`,
    `model_probe_first_delta_ms=${modelStreamProbe?.first_delta_ms ?? "-"}`,
    `action=${status.last_action_status || "idle"}`,
    `tool=${status.last_action_tool || "-"}`,
    ttsStateLabel,
    `tts_state=${status.audio_out_state || "idle"}`,
    `tts_transport=${status.tts_transport || status.streaming_risk?.tts_transport || "segmented_tts_queue"}`,
    `streaming_tts=${streamingTtsConfigured ? "configured" : "not_configured"}`,
    `streaming_tts_url=${compactGoalText(status.streaming_tts_url || "", 90) || "-"}`,
    `tts_probe=${streamingTtsProbeLabel}`,
    `tts_source=${status.last_tts_source || "-"}`,
    `tts_segments=${status.last_tts_played || 0}/${status.last_tts_segment_count || 0}`,
    riskStateLabel,
    gateStateLabel,
    `barge=${status.barge_in_state || "quiet"}`,
    `barge_decision=${status.last_barge_in_decision || "-"}`,
    `frames=${status.vision_frames_processed || 0}`,
    `elements=${status.vision_element_count || 0}`,
  ];
  return {
    id: "runtime-realtime-session",
    owner_agent: "realtime-session",
    executor_agent: "Realtime vision voice session",
    status: "running",
    summary: states.join(" / "),
    readiness_gates: gates.map((gate) => ({
      id: gate?.id || "",
      label: gate?.label || "",
      ready: Boolean(gate?.ready),
      reason: gate?.reason || "",
    })),
    startedAt,
    timeout_ms: 0,
  };
}

function syncRealtimeSessionTask(status = realtimeSessionStatus) {
  realtimeSessionRuntimeTask = realtimeSessionTaskItem(status);
  syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
}

function selectTaskCardGoal(goals = []) {
  const ordered = Array.isArray(goals)
    ? goals.slice().sort((left, right) => goalUpdatedAt(right) - goalUpdatedAt(left))
    : [];
  return ordered[0] || null;
}

function taskCardActivePhase(goal = {}) {
  const phases = Array.isArray(goal.phases) ? goal.phases : [];
  return phases.find((phase) => ["running", "pending", "failed"].includes(phase.status))
    || phases[phases.length - 1]
    || null;
}

function taskCardSummaryText({ activeGoal = null, runtimeTask = null } = {}) {
  if (runtimeTask) {
    const summary = String(runtimeTask.summary || "").trim();
    const owner = runtimeTask.executor_agent || runtimeTask.owner_agent || "子 agent";
    if (summary) {
      return `${owner}: ${compactGoalText(summary, 120)}`;
    }
    return `${owner}: 子 agent 任务已启动，等待执行摘要`;
  }
  if (activeGoal) {
    const phase = taskCardActivePhase(activeGoal);
    const phaseLabel = phase?.title || activeGoal.title || activeGoal.id || "Goal";
    const role = phase?.assigned_role || "";
    const status = phase?.status || activeGoal.status || "";
    return compactGoalText([role, phaseLabel, status].filter(Boolean).join(" · "), 120);
  }
  return "";
}

function setTaskCardSummary(summary) {
  const summaryEl = bindings.get("task.currentSummary");
  if (!summaryEl) {
    return;
  }
  const text = String(summary || "").trim();
  summaryEl.textContent = text || "暂无摘要";
  summaryEl.title = text;
}

function syncTaskCardFromGoals(goals = [], runtimeTasks = taskRuntimeItems) {
  const titleEl = bindings.get("task.currentTitle");
  const progressEl = bindings.get("task.currentProgress");
  const summaryEl = bindings.get("task.currentSummary");
  if (!titleEl && !progressEl && !summaryEl) {
    return;
  }
  const progressBar = document.querySelector('[data-role="task-card-progress-bar"]');
  const visibleGoals = taskCardVisibleGoals(goals, runtimeTasks);
  renderTaskStatusSummary(visibleGoals, runtimeTasks);
  const activeGoal = selectTaskCardGoal(visibleGoals);
  if (!activeGoal) {
    const runtimeTask = Array.isArray(runtimeTasks) && runtimeTasks.length ? runtimeTasks[0] : null;
    if (runtimeTask) {
      const name = runtimeTask.executor_agent || runtimeTask.owner_agent || "运行任务";
      const runtimeStatus = runtimeTaskTodoStatus(runtimeTask);
      // 视频等待时长（mm:ss）+ 进度%进任务卡片：summary 形如"视频生成中 35%"时提取百分比，
      // startedAt 折算等待时长（每轮轮询刷新，时长随之增长）。
      const pctMatch = /(\d+)\s*%/.exec(runtimeTask.summary || "");
      const pct = pctMatch ? Number(pctMatch[1]) : null;
      const elapsed = formatTaskElapsed(runtimeTask.startedAt);
      let progressText;
      let progressWidth;
      if (runtimeStatus === "completed") {
        progressText = "100%";
        progressWidth = "100%";
      } else if (runtimeStatus === "failed") {
        progressText = "异常";
        progressWidth = "15%";
      } else if (runtimeStatus === "pending") {
        progressText = pct != null ? `${pct}% · ${elapsed}` : `待处理 · ${elapsed}`;
        progressWidth = pct != null ? `${Math.max(5, pct)}%` : "10%";
      } else {
        progressText = pct != null ? `${pct}% · ${elapsed}` : `进行中 · ${elapsed}`;
        progressWidth = pct != null ? `${Math.max(5, pct)}%` : "45%";
      }
      if (titleEl) { titleEl.textContent = taskCardBriefName(name); titleEl.title = runtimeTask.summary || name; }
      if (progressEl) progressEl.textContent = progressText;
      if (progressBar) progressBar.style.width = progressWidth;
      setTaskCardSummary(taskCardSummaryText({ runtimeTask }));
      renderTaskTodoList(visibleGoals, runtimeTasks);
      return;
    }
    if (titleEl) { titleEl.textContent = "空闲"; titleEl.title = ""; }
    if (progressEl) progressEl.textContent = "0%";
    if (progressBar) progressBar.style.width = "0%";
    setTaskCardSummary("");
    renderTaskTodoList(visibleGoals, runtimeTasks);
    return;
  }
  // 任务卡片只显示简要任务名（截断 + 悬浮全名）
  const fullName = activeGoal.title || activeGoal.id || "Goal";
  if (titleEl) {
    titleEl.textContent = taskCardBriefName(fullName);
    titleEl.title = fullName;
  }
  const phases = Array.isArray(activeGoal.phases) ? activeGoal.phases : [];
  const progress = phases.length
    ? Math.round((phases.filter((phase) => phase.status === "completed").length / phases.length) * 100)
    : (activeGoal.status === "completed" ? 100 : 0);
  const activePhase = phases.find((phase) => ["running", "pending", "failed"].includes(phase.status))
    || phases[phases.length - 1];
  const phaseStatus = activeGoal.status === "paused" ? "paused" : (activePhase?.status || activeGoal.status || "-");
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.parentElement?.parentElement?.classList?.toggle("is-paused", activeGoal.status === "paused");
  }
  if (progressEl) {
    const label = phaseStatus === "paused" ? `${progress}% · 暂停` : `${progress}%`;
    progressEl.textContent = label;
    progressEl.title = phases.length ? `${phases.filter((p) => p.status === "completed").length}/${phases.length} 阶段完成 · ${phaseStatus}` : label;
  }
  setTaskCardSummary(taskCardSummaryText({ activeGoal }));
  // 任务卡片 todo 清单（参考截图：任务名 + 状态徽章 + 耗时）
  renderTaskTodoList(visibleGoals, runtimeTasks);
}

// 任务状态 → 徽章类名 + 中文标签（运行中/排队中/完成/失败重试），与截图配色一致
const TASK_TODO_STATUS = {
  running: { cls: "running", label: "运行中" },
  pending: { cls: "pending", label: "排队中" },
  completed: { cls: "done", label: "完成" },
  failed: { cls: "failed", label: "失败重试" },
  rejected: { cls: "failed", label: "失败重试" },
  blocked: { cls: "failed", label: "失败重试" },
  paused: { cls: "pending", label: "已暂停" },
  cancelled: { cls: "muted", label: "已取消" },
  skipped: { cls: "muted", label: "已跳过" },
};
function taskTodoStatusMeta(status) {
  return TASK_TODO_STATUS[String(status || "").toLowerCase()] || { cls: "pending", label: status || "排队中" };
}

function normalizeRuntimeTaskItems(tasks = []) {
  const now = Date.now();
  return (Array.isArray(tasks) ? tasks : []).map((task, index) => ({
    id: task.id || `runtime-${index}`,
    owner_agent: task.owner_agent || "",
    executor_agent: task.executor_agent || "运行任务",
    status: task.status || "pending",
    summary: task.summary || "",
    readiness_gates: Array.isArray(task.readiness_gates) ? task.readiness_gates : [],
    startedAt: task.startedAt || task.started_at || now,
    timeout_ms: task.timeout_ms || 0,
  }));
}

function runtimeTaskTodoStatus(task = {}) {
  const text = `${task.status || ""} ${task.summary || ""}`.toLowerCase();
  if (text.includes("失败") || text.includes("failed")) return "failed";
  if (text.includes("压缩") || text.includes("完成") || text.includes("已") || text.includes("ok")) return "completed";
  if (text.includes("运行") || text.includes("running")) return "running";
  return "pending";
}

function runtimeTaskTodoName(task = {}) {
  const owner = task.executor_agent || task.owner_agent || "运行任务";
  const summary = String(task.summary || "").trim();
  if (!summary) {
    return owner;
  }
  return `${owner}: ${compactGoalText(summary, 48)}`;
}

function realtimeReadinessGateLabel(gate = {}) {
  const labels = {
    provider_native_partial_asr: "Provider-native partial ASR",
    far_end_reference_aec: "Far-end reference AEC",
    realtime_model_adapter: "Realtime model adapter",
    streaming_tts_output: "Streaming TTS output",
  };
  return gate.label || labels[gate.id] || gate.id || "readiness gate";
}

function runtimeTaskReadinessGateTodoItems(task = {}) {
  const gates = Array.isArray(task.readiness_gates) ? task.readiness_gates : [];
  return gates.map((gate) => {
    const label = realtimeReadinessGateLabel(gate);
    const reason = gate.reason || (gate.ready ? "ready" : "not ready");
    return {
      name: `Full streaming gate: ${label}${gate.ready ? "" : ` · ${compactGoalText(reason, 48)}`}`,
      status: gate.ready ? "completed" : "pending",
      startedAt: task.startedAt || Date.now(),
      retry: 0,
      title: `${label}: ${reason}`,
    };
  });
}

// 把毫秒时长格式化为 mm:ss 或 HH:mm:ss；无开始时间显示 --:--
function formatTaskElapsed(startedAt) {
  const start = Number(startedAt);
  if (!Number.isFinite(start) || start <= 0) {
    return "--:--";
  }
  let secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(secs / 3600);
  secs -= h * 3600;
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function taskTodoTimeText(item = {}) {
  const status = String(item.status || "").toLowerCase();
  if (status === "running") {
    return formatTaskElapsed(item.startedAt);
  }
  if (status === "completed") {
    return "已完成";
  }
  return "--:--";
}

// 把多个 goal 的阶段聚合成 todo 条目（每个 phase 一条），按状态优先级排序
function collectTaskTodoItems(goals = [], runtimeTasks = taskRuntimeItems) {
  const items = [];
  (Array.isArray(goals) ? goals : []).forEach((goal) => {
    const phases = Array.isArray(goal.phases) ? goal.phases : [];
    if (!phases.length) {
      // 无阶段的 goal 退化为单条
      items.push({
        name: goal.title || goal.id || "Goal",
        status: goal.status || "pending",
        startedAt: goalUpdatedAt(goal),
        retry: 0,
      });
      return;
    }
    phases.forEach((phase) => {
      items.push({
        name: phase.title || phase.id || "Phase",
        status: goal.status === "paused" ? "paused" : (phase.status || "pending"),
        startedAt: phase.updated_at || phase.created_at || goalUpdatedAt(goal),
        retry: Number(phase.retry_count || phase.impl_retry_count || 0),
      });
    });
  });
  (Array.isArray(runtimeTasks) ? runtimeTasks : []).forEach((task) => {
    items.push({
      name: runtimeTaskTodoName(task),
      status: runtimeTaskTodoStatus(task),
      startedAt: task.startedAt || Date.now(),
      retry: 0,
    });
    items.push(...runtimeTaskReadinessGateTodoItems(task));
  });
  // 排序：运行中 > 排队中 > 失败 > 完成
  const order = { running: 0, pending: 1, paused: 1, failed: 2, rejected: 2, blocked: 2, completed: 3, cancelled: 4, skipped: 4 };
  items.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  return items;
}

function taskStatusSnapshot(goals = [], runtimeTasks = taskRuntimeItems) {
  const snapshot = { running: 0, queued: 0, completed: 0, failed: 0, successRate: 0 };
  collectTaskTodoItems(goals, runtimeTasks).forEach((item) => {
    const status = String(item.status || "pending").toLowerCase();
    if (status === "running") {
      snapshot.running += 1;
    } else if (["completed"].includes(status)) {
      snapshot.completed += 1;
    } else if (["failed", "rejected", "blocked"].includes(status)) {
      snapshot.failed += 1;
    } else if (!["cancelled", "skipped"].includes(status)) {
      snapshot.queued += 1;
    }
  });
  const terminal = snapshot.completed + snapshot.failed;
  snapshot.successRate = terminal ? Math.round((snapshot.completed / terminal) * 100) : 0;
  return snapshot;
}

function renderTaskStatusSummary(goals = [], runtimeTasks = taskRuntimeItems) {
  const snapshot = taskStatusSnapshot(goals, runtimeTasks);
  setBindText("task.statusRunning", String(snapshot.running));
  setBindText("task.statusQueued", String(snapshot.queued));
  setBindText("task.statusCompleted", String(snapshot.completed));
  setBindText("task.statusFailed", String(snapshot.failed));
  setBindText("task.successRate", `${snapshot.successRate}%`);
  const bar = document.querySelector('[data-role="task-success-rate-bar"]');
  if (bar) {
    bar.style.width = `${snapshot.successRate}%`;
  }
  const host = document.querySelector('[data-role="task-success-rate"]');
  if (host) {
    host.classList.toggle("has-failures", snapshot.failed > 0);
    host.classList.toggle("is-complete", snapshot.completed > 0 && snapshot.failed === 0 && snapshot.running === 0 && snapshot.queued === 0);
  }
}

function renderTaskTodoList(goals = [], runtimeTasks = taskRuntimeItems) {
  const host = document.querySelector('[data-role="task-todo-list"]');
  if (!host) {
    return;
  }
  const items = collectTaskTodoItems(goals, runtimeTasks).slice(0, 6);
  host.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "task-todo-empty";
    empty.textContent = "暂无进行中的任务";
    host.append(empty);
    return;
  }
  items.forEach((item) => {
    const meta = taskTodoStatusMeta(item.status);
    const li = document.createElement("li");
    li.className = "task-todo-item";
    li.title = item.title || item.name || "";
    const name = document.createElement("span");
    name.className = "task-todo-name";
    name.textContent = item.name;
    name.title = item.title || item.name;
    const badge = document.createElement("em");
    badge.className = `task-todo-badge ${meta.cls}`;
    badge.textContent = meta.retry > 0 && meta.cls === "failed" ? `失败重试${item.retry}` : meta.label;
    const time = document.createElement("b");
    time.className = "task-todo-time";
    // 只有运行中的当前任务滚动计时；完成/排队显示明确状态，避免旧任务出现数百小时计时。
    time.textContent = taskTodoTimeText(item);
    time.dataset.startedAt = item.status === "running" ? String(item.startedAt || 0) : "";
    li.append(name, badge, time);
    host.append(li);
  });
}

// 每秒刷新运行中任务的耗时文本（只改时间，不重建 DOM）
function tickTaskTodoTimers() {
  document.querySelectorAll('[data-role="task-todo-list"] .task-todo-time').forEach((node) => {
    const started = Number(node.dataset.startedAt);
    if (Number.isFinite(started) && started > 0) {
      node.textContent = formatTaskElapsed(started);
    }
  });
}

// 任务卡片简要名：去掉冗长前缀、截断到约 18 字符
function taskCardBriefName(name) {
  const text = String(name || "").trim();
  if (text.length <= 18) {
    return text;
  }
  return `${text.slice(0, 17)}…`;
}

function taskRenderAuditSummary(entries = []) {
  const list = document.querySelector('[data-role="task-audit-summary"]');
  setBindText("tasks.auditCount", String(entries.length));
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "task-window-empty";
    empty.textContent = "暂无审计摘要。";
    list.append(empty);
    return;
  }
  entries.slice().reverse().slice(0, 8).forEach((entry) => {
    const item = document.createElement("article");
    item.className = `task-audit-item is-${entry.status || "unknown"}`;
    const perm = entry.permission || {};
    item.innerHTML = `
      <strong>${escapeHtml(entry.tool_name || "-")}</strong>
      <p>${escapeHtml(entry.summary_text || entry.input_summary || "")}</p>
      <small>${escapeHtml(entry.caller || "-")} / ${escapeHtml(entry.status || "-")} / ${escapeHtml(perm.decision || "-")}</small>
    `;
    list.append(item);
  });
}

async function refreshState() {
  try {
    const state = await requestJson("/api/state");
    setText("overview.activeAgentCount", String(state.overview?.active_agent_count ?? 0));
    activeOverviewVisionAgent = state.overview?.vision_agent ?? null;
    renderVisionAgentSelect(activeOverviewVisionAgent);
    setText("overview.chatRoomCount", String(state.overview?.chat_room_count ?? 0));
    activeWorkspaceKey = composerDraftWorkspaceKey(state.workspace);
    setText("project.path", state.workspace);
    setText("config.provider", state.models.reasoning);
    setText("config.model", state.models.vision);
    setVisionPreview(state.latest_capture);
    setText("tools.cli", state.tools.cli);
    setText("tools.skills", state.tools.skills);
    setText("tools.plugins", state.tools.plugins);
    setText("stability.mode", state.stability.mode);
    addMessage({
      author: "COOLZHU AGENT",
      text: `后端已连接。稳定性矩阵包含 ${state.stability.resolution_cases} 组分辨率、${state.stability.scenarios} 个操作场景。`,
      kind: "bot",
      icon: "robot-message",
    });
  } catch (error) {
    addMessage({
      author: "系统消息",
      text: `后端暂未连接：${error.message}`,
      kind: "thought",
      icon: "system-message",
    });
  }
}

function setSystemInfoText(role, value, title = "") {
  const node = document.querySelector(`[data-role="${role}"]`);
  if (!node) {
    return;
  }
  const text = value == null || value === "" ? "—" : String(value);
  node.textContent = text;
  node.title = title || text;
}

async function refreshSystemInfo() {
  try {
    const info = await requestJson("/api/system/info");
    setSystemInfoText("system-workspace", info.workspace);
    setSystemInfoText("system-port", info.port ? `:${info.port}` : "—");
    setSystemInfoText("system-build", info.build_version);
    setSystemInfoText("system-sessions", `${info.active_sessions ?? 0} 个`);
    setOverviewWorkspaceName(info.workspace);
  } catch (error) {
    setSystemInfoText("system-workspace", "后端未连接", error.message);
    setSystemInfoText("system-port", "—");
    setSystemInfoText("system-build", "—");
    setSystemInfoText("system-sessions", "—");
    setOverviewWorkspaceName("");
  }
}

// 总览卡头部工作区名：显示路径末段目录名，完整路径存 dataset 供点击复制
function setOverviewWorkspaceName(workspace) {
  const label = document.querySelector('[data-role="overview-workspace-label"]');
  const button = document.querySelector('[data-role="overview-workspace-name"]');
  const full = String(workspace || "").trim();
  const baseName = full ? full.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || full : "";
  if (label) {
    label.textContent = baseName || "当前工作区";
  }
  if (button) {
    button.dataset.workspacePath = full;
    button.title = full ? `点击复制：${full}` : "工作区路径未就绪";
  }
}

async function copyOverviewWorkspacePath() {
  const button = document.querySelector('[data-role="overview-workspace-name"]');
  const full = button?.dataset.workspacePath || "";
  if (!full) {
    return;
  }
  try {
    await navigator.clipboard.writeText(full);
    button.classList.add("is-copied");
    window.setTimeout(() => button.classList.remove("is-copied"), 1200);
  } catch (error) {
    console.warn("[overview] copy workspace path failed", error);
  }
}

function renderShowUiServiceStatus(status = {}) {
  showUiServiceStatus = {
    enabled: Boolean(status.enabled),
    running: Boolean(status.running),
    pid: status.pid ?? null,
    disabled: Boolean(status.disabled),
    message: status.message || "",
  };
  const enabled = showUiServiceStatus.enabled && !showUiServiceStatus.disabled;
  const showUiServiceActive = enabled && showUiServiceStatus.running;
  const label = showUiServiceStatus.disabled
    ? "ShowUI disabled"
    : showUiServiceActive
      ? `ShowUI running${showUiServiceStatus.pid ? ` #${showUiServiceStatus.pid}` : ""}`
      : showUiServiceStatus.running
        ? `ShowUI shell running${showUiServiceStatus.pid ? ` #${showUiServiceStatus.pid}` : ""}`
        : "ShowUI stopped";
  setBindText("showui.serviceStatus", label);
  const button = actionButtons.get("showui-service-toggle");
  if (!button) {
    return;
  }
  button.classList.toggle("is-running", showUiServiceActive);
  button.setAttribute("aria-pressed", showUiServiceActive ? "true" : "false");
  button.dataset.label = showUiServiceActive ? "停止" : "启动";
  button.textContent = showUiServiceActive ? "停止" : "启动";
  button.disabled = showUiServiceStatus.disabled;
  button.title = showUiServiceStatus.message || label;
}

async function refreshShowUiServiceStatus() {
  try {
    const status = await requestJson("/api/showui/service");
    renderShowUiServiceStatus(status);
  } catch (error) {
    setBindText("showui.serviceStatus", `ShowUI error: ${error.message}`);
  }
}

async function toggleShowUiService() {
  const button = actionButtons.get("showui-service-toggle");
  const nextEnabled = !showUiServiceStatus.running;
  setBusy(button, true, nextEnabled ? "启动中..." : "停止中...");
  try {
    const status = await requestJson("/api/showui/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    renderShowUiServiceStatus(status);
  } catch (error) {
    setBindText("showui.serviceStatus", `ShowUI error: ${error.message}`);
  } finally {
    setBusy(button, false);
    renderShowUiServiceStatus(showUiServiceStatus);
  }
}

function overviewVisionAgentLabel(agent) {
  if (!agent) {
    return "未配置";
  }
  const name = agent.display_name || agent.name || agent.id || "视觉 Agent";
  return agent.model ? `${name} · ${agent.model}` : name;
}

function renderVisionAgentSelect(activeVisionAgent) {
  // 同时渲染设置窗口与总览的视觉理解模型选择器（候选 = vision/multimodal/video 会话；
  // ShowUI 是 grounding 后端不算 Agent）。选中项即 active_vision_session_id，可随时更换。
  const selects = [
    document.querySelector('[data-role="settings-vision-agent"]'),
    document.querySelector('[data-role="overview-vision-agent"]'),
  ].filter(Boolean);
  if (!selects.length) return;
  const sessions = sessionRegistry?.sessions || [];
  selects.forEach((select) => {
    select.replaceChildren();
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "未配置";
    select.append(noneOpt);
    sessions.forEach((session) => {
      const mt = session.model_type || MODEL_TYPE_MAP[session.model] || "text";
      // coolzhu 本地模型（Gemma 4 12B，端口 8082）是多模态，纳入视觉理解候选。
      const isLocalModel = `${session.base_url || ""}${session.endpoint || ""}`.includes(":8082");
      if (mt === "vision" || mt === "multimodal" || mt === "video" || isLocalModel) {
        const opt = document.createElement("option");
        opt.value = session.id;
        opt.textContent = session.display_name || session.name;
        select.append(opt);
      }
    });
    select.value = activeVisionAgent?.id || "";
  });
}

function beginWorkspaceEdit() {
  const node = document.querySelector('[data-bind="project.path"]');
  if (!node || node.querySelector("input")) {
    return;
  }
  const current = node.textContent.trim();
  const input = document.createElement("input");
  input.className = "project-path-input";
  input.value = current;
  input.setAttribute("aria-label", "工程目录路径");
  node.replaceChildren(input);
  input.focus();
  input.select();
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      setText("project.path", current);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      await saveWorkspacePath(input.value, current);
    }
  });
  input.addEventListener("blur", () => {
    if (document.activeElement !== input) {
      setText("project.path", current);
    }
  });
}

async function saveWorkspacePath(path, fallbackPath) {
  const trimmed = String(path || "").trim();
  if (!trimmed) {
    setText("project.path", fallbackPath);
    return;
  }
  try {
    const result = await requestJson("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: trimmed }),
    });
    setText("project.path", result.workspace);
    await refreshWorkspaceBoundState(result.workspace);
    addMessage({
      author: "工程目录",
      text: `${result.message}\n${result.workspace}`,
      kind: "thought",
      icon: "task-list",
    });
  } catch (error) {
    setText("project.path", fallbackPath);
    addMessage({
      author: "工程目录",
      text: `路径切换失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  }
}

async function refreshWorkspaceBoundState(workspace) {
  resetWorkspaceBoundUiState(workspace);
  await refreshState();

  const refreshSteps = [
    ["Project tree", loadProjectTree],
    ["Protected rules", refreshProtectedPaths],
    ["Full access", refreshFullAccessStatus],
    ["会话配置", loadSessions],
    ["Agent 发送对象", loadAgents],
    ["聊天室", loadChatRooms],
    ["工具目录", loadToolsCatalog],
    ["工具审计", refreshToolAudit],
    ["Goals", refreshGoals],
  ];

  for (const [label, loader] of refreshSteps) {
    try {
      await loader();
    } catch (error) {
      addMessage({
        author: "工程目录",
        text: `${label} 刷新失败：${error.message}`,
        kind: "thought",
        icon: "error-log",
      });
    }
  }
}

function resetWorkspaceBoundUiState(workspace) {
  activeWorkspaceKey = composerDraftWorkspaceKey(workspace);
  agentRegistry = { agents: [], active_agent_ids: [] };
  sessionRegistry = { sessions: [], active_session_id: null, max_sessions: 10 };
  goalRoleRegistry = { roles: [], commander_session_id: null, generated_at: null };
  chatRoomRegistry = { rooms: [], active_room_id: null, max_rooms: 8 };
  chatRoster = { room_id: null, members: [] };
  chatHandoffs = [];
  taskGoals = [];
  handoffDrawerOpen = false;
  activeSessionId = null;
  activeChatRoomId = null;
  activeOverviewVisionAgent = null;
  selectedProjectPath = "";
  projectTreeRoot = null;
  expandedProjectPaths.clear();
  toolDetailCache = new Map();
  selectedMessageIds.clear();
  pendingFileAttachments.length = 0;
  lastUserIntent = "";
  closeGoalEventSources();

  renderAgentOptions([], []);
  renderSessionList([], null);
  renderChatRoomList([], null);
  renderChatRoster([]);
  renderHandoffList([]);
  taskRenderGoalRoleRisks([]);
  renderVisionAgentSelect(null);
  renderProjectTree([]);
  updateProjectPreview("Select a file to preview.", "Workspace changed.");
  setSessionForm(null);
  updateSessionTrigger("暂无会话");
  updateChatRoomTrigger("主聊天室");
  setText("session.active", "加载中");
  setText("chat.current", "加载中");
  clearChatMessagesUi();
  clearComposerAttachments();

  const input = document.querySelector('[data-role="message-input"]');
  if (input) {
    input.value = "";
  }
}

async function loadAvatarManifest() {
  try {
    const response = await fetch("./assets/avatars/manifest.json", { cache: "no-store" });
    if (!response.ok) {
      avatarManifest = [];
      avatarManifestByFile = new Map();
      renderAvatarPicker();
      renderOverviewMascot();
      return;
    }
    const manifest = await response.json();
    avatarManifest = Array.isArray(manifest) ? manifest.filter((item) => avatarPathAllowed(item?.file)) : [];
    avatarManifestByFile = new Map(avatarManifest.map((item) => [avatarPathFromFile(item.file), item]));
    renderAvatarPicker();
    renderOverviewMascot();
  } catch (error) {
    avatarManifest = [];
    avatarManifestByFile = new Map();
    renderAvatarPicker();
    renderOverviewMascot();
  }
}

function avatarPathAllowed(file) {
  const value = String(file || "").trim().replace(/\\/g, "/");
  return /^(?:wuxia-v3\/)?[a-z0-9][a-z0-9._-]*\.(png|webp)$/i.test(value);
}

function avatarPathFromFile(file) {
  return `assets/avatars/${String(file || "").trim().replace(/\\/g, "/")}`;
}

function migrateLegacyAvatarPath(path) {
  const normalized = String(path || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  return LEGACY_AVATAR_MIGRATIONS.get(normalized) || normalized;
}

function avatarUrl(path) {
  return path ? `./${path}` : "";
}

function iconUrl(icon) {
  const normalized = String(icon || "").trim().replace(/\.png$/i, "");
  const wuxiaIcon = WUXIA_ICON_ALIASES.get(normalized);
  return wuxiaIcon ? `./assets/icons-wuxia/${wuxiaIcon}.svg` : `./assets/icons/${normalized}.png`;
}

function sessionByAuthor(author) {
  const label = String(author || "").trim();
  if (!label) return null;
  const sessions = Array.isArray(sessionRegistry.sessions) ? sessionRegistry.sessions : [];
  return sessions.find((session) => {
    const display = session.display_name || `${session.name || session.id} (${session.model || "-"})`;
    return label === session.id || label === session.name || label === display || label.startsWith(display) || label.startsWith(session.name);
  }) || null;
}

function sessionById(sessionId) {
  const sessions = Array.isArray(sessionRegistry.sessions) ? sessionRegistry.sessions : [];
  return sessions.find((session) => session.id === sessionId) || null;
}

function avatarForSession(session) {
  const path = migrateLegacyAvatarPath(session?.avatar || "");
  return avatarManifestByFile.has(path) ? path : null;
}

function avatarForAuthor(author) {
  return avatarForSession(sessionByAuthor(author));
}

function avatarThemeForPath(path) {
  return avatarManifestByFile.get(migrateLegacyAvatarPath(path))?.theme_color || "#8fd3b1";
}

function defaultIconUrlForIcon(icon) {
  if (icon === "mario" || icon === "robot-message") {
    return `./${DEFAULT_WUXIA_AVATAR_PATH}`;
  }
  return iconUrl(icon);
}

function defaultIconUrlForMessage(message) {
  return defaultIconUrlForIcon(iconForMessage(message));
}

function defaultIconUrlForSession(session) {
  const modelType = String(session?.model_type || MODEL_TYPE_MAP[session?.model] || "text").toLowerCase();
  if (modelType === "vision" || modelType === "multimodal") {
    return iconUrl("inner-vision");
  }
  if (modelType === "video") {
    return iconUrl("image-preview");
  }
  if (modelType === "audio") {
    return iconUrl("microphone");
  }
  return `./${DEFAULT_WUXIA_AVATAR_PATH}`;
}

function currentAvatarPathFromForm() {
  return document.querySelector('[data-action="session-avatar-toggle"]')?.dataset.avatar || "";
}

function setSessionAvatarForm(path) {
  const migrated = migrateLegacyAvatarPath(path);
  const normalized = migrated && avatarManifestByFile.has(migrated) ? migrated : "";
  const trigger = document.querySelector('[data-action="session-avatar-toggle"]');
  const preview = document.querySelector('[data-role="session-avatar-preview"]');
  const label = document.querySelector('[data-role="session-avatar-label"]');
  if (trigger) {
    trigger.dataset.avatar = normalized;
    trigger.style.setProperty("--avatar-theme", normalized ? avatarThemeForPath(normalized) : "#ffd552");
  }
  if (preview) {
    preview.src = normalized ? avatarUrl(normalized) : `./${DEFAULT_WUXIA_AVATAR_PATH}`;
  }
  if (label) {
    label.textContent = normalized ? (avatarManifestByFile.get(normalized)?.name || "自定义头像") : "默认图标";
  }
  document.querySelectorAll("[data-avatar-choice]").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.avatarChoice === normalized);
  });
}

function renderAvatarPicker() {
  const picker = document.querySelector('[data-role="avatar-picker"]');
  if (!picker) return;
  picker.replaceChildren();
  const defaultButton = document.createElement("button");
  defaultButton.type = "button";
  defaultButton.className = "avatar-choice is-default";
  defaultButton.dataset.avatarChoice = "";
  defaultButton.innerHTML = `<span class="avatar-choice-fallback">默认</span><b>默认图标</b>`;
  picker.append(defaultButton);

  avatarManifest.forEach((item) => {
    const path = avatarPathFromFile(item.file);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "avatar-choice";
    button.dataset.avatarChoice = path;
    button.style.setProperty("--avatar-theme", item.theme_color || "#ffd552");
    const img = document.createElement("img");
    img.src = avatarUrl(path);
    img.alt = "";
    const text = document.createElement("b");
    text.textContent = item.name || item.file;
    button.append(img, text);
    picker.append(button);
  });

  picker.querySelectorAll("[data-avatar-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      setSessionAvatarForm(button.dataset.avatarChoice || "");
      closeAvatarPicker();
    });
  });
  setSessionAvatarForm(currentAvatarPathFromForm());
}

function mountAvatarPickerPortal() {
  const picker = document.querySelector('[data-role="avatar-picker"]');
  if (!picker) return null;
  if (!picker.classList.contains("is-portal")) {
    document.body.append(picker);
    picker.classList.add("is-portal");
  }
  return picker;
}

function positionAvatarPicker() {
  const picker = document.querySelector('[data-role="avatar-picker"]');
  const trigger = document.querySelector('[data-action="session-avatar-toggle"]');
  if (!picker || !trigger || picker.hidden || !picker.classList.contains("is-portal")) return;

  const viewportGap = 12;
  const triggerGap = 8;
  const triggerRect = trigger.getBoundingClientRect();
  const width = Math.min(360, Math.max(240, window.innerWidth - viewportGap * 2));
  const availableBelow = window.innerHeight - triggerRect.bottom - triggerGap - viewportGap;
  const availableAbove = triggerRect.top - triggerGap - viewportGap;
  const placeBelow = availableBelow >= Math.min(260, picker.scrollHeight) || availableBelow >= availableAbove;
  const availableHeight = placeBelow ? availableBelow : availableAbove;
  const maxHeight = Math.max(160, Math.min(350, availableHeight));
  const left = Math.min(
    Math.max(viewportGap, triggerRect.right - width),
    Math.max(viewportGap, window.innerWidth - width - viewportGap),
  );
  const top = placeBelow
    ? triggerRect.bottom + triggerGap
    : Math.max(viewportGap, triggerRect.top - triggerGap - maxHeight);

  picker.style.left = `${Math.round(left)}px`;
  picker.style.top = `${Math.round(top)}px`;
  picker.style.width = `${Math.round(width)}px`;
  picker.style.maxHeight = `${Math.round(maxHeight)}px`;
}

function toggleAvatarPicker(event) {
  event?.preventDefault();
  const picker = mountAvatarPickerPortal();
  if (!picker) return;
  if (!avatarManifest.length) {
    renderAvatarPicker();
  }
  const opening = picker.hidden;
  picker.hidden = !opening;
  if (opening) {
    requestAnimationFrame(positionAvatarPicker);
  }
}

function closeAvatarPicker() {
  const picker = document.querySelector('[data-role="avatar-picker"]');
  if (picker) picker.hidden = true;
}

async function loadAgents() {
  try {
    const registry = await requestJson("/api/agents");
    agentRegistry = registry;
    const selectable = registry.agents.filter((agent) => agent.selectable);
    const active = selectable.find((agent) => registry.active_agent_ids.includes(agent.id)) ?? selectable[0];

    setText("agent.current", active ? `${active.name} (${active.model})` : "未选择");
    setText("agent.provider", active?.provider ?? "未配置");
    setText("agent.model", active?.model ?? "未配置");
    setText("agent.key", active?.api_key_status ?? "待配置");
    setText("agent.memoryState", registry.memory.architecture === "beads" ? "beads 分层" : "会话独立");
    setText("agent.memory", registry.memory.scope);
    setText("agent.window", registry.memory.window_strategy);
    renderAgentOptions(selectable, registry.active_agent_ids);
    restoreAgentTargets(selectable, registry.active_agent_ids, activeChatRoomId);
    renderGoalRoleAssignmentMatrix();
    renderOverviewHealth(agentRegistry);
    renderOverviewMascot();
  } catch (error) {
    agentRegistry = { agents: [], active_agent_ids: [] };
    setText("agent.current", "加载失败");
    setText("agent.provider", "加载失败");
    setText("agent.model", "加载失败");
    setText("agent.key", "加载失败");
    setText("agent.memoryState", "加载失败");
    renderAgentOptions([], []);
    renderOverviewHealth(agentRegistry);
    renderOverviewMascot();
    addMessage({
      author: "Agent 状态",
      text: `Agent 状态加载失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  }
}

async function loadSessions() {
  try {
    const registry = await requestJson("/api/sessions");
    sessionRegistry = registry;
    activeSessionId = registry.active_session_id ?? registry.sessions[0]?.id ?? null;
    renderSessionList(registry.sessions, activeSessionId);
    renderTaskScheduleSessionOptions();
    renderGoalRoleAssignmentMatrix();
    renderVisionAgentSelect(activeOverviewVisionAgent);
    renderOverviewMascot();

    const active = registry.sessions.find((session) => session.id === activeSessionId) ?? registry.sessions[0];
    setSessionForm(active);
    syncActiveSessionSummary(active);
    if (active) {
      setText("agent.current", active.display_name);
      setText("agent.provider", active.provider);
      setText("agent.model", active.model);
      setText("agent.key", active.api_key_status || "待配置");
      setText("agent.memoryState", "会话独立");
      setText("session.active", active.display_name);
    } else {
      setText("session.active", "暂无会话");
    }
  } catch (error) {
    sessionRegistry = { sessions: [], active_session_id: null, max_sessions: 10 };
    activeSessionId = null;
    renderSessionList([], null);
    renderGoalRoleAssignmentMatrix();
    setSessionForm(null);
    setText("agent.current", "加载失败");
    setText("session.active", "加载失败");
    addMessage({
      author: "会话管理",
      text: `会话加载失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  }
}

function syncActiveSessionSummary(session) {
  if (!session) {
    setText("session.active", "暂无会话");
    setText("agent.current", "暂无会话");
    setText("agent.provider", "-");
    setText("agent.model", "-");
    setText("agent.key", "-");
    setText("agent.memoryState", "-");
    return;
  }
  setText("session.active", session.display_name);
  setText("agent.current", session.display_name);
  setText("agent.provider", session.provider || "-");
  setText("agent.model", session.model || "-");
  setText("agent.key", session.api_key_status || "待配置");
  setText("agent.memoryState", "会话独立");
}

async function loadChatRooms() {
  const registry = await requestJson("/api/chat/rooms");
  chatRoomRegistry = registry;
  activeChatRoomId = registry.active_room_id ?? registry.rooms[0]?.id ?? null;
  renderChatRoomList(registry.rooms, activeChatRoomId);

  const active = registry.rooms.find((room) => room.id === activeChatRoomId) ?? registry.rooms[0];
  if (active) {
    updateChatRoomTrigger(active.name);
    restoreAgentTargets(
      agentRegistry.agents.filter((agent) => agent.selectable),
      agentRegistry.active_agent_ids,
      active.id,
    );
    await loadChatRoomMessages(active.id);
    await refreshChatCollaboration(active.id);
    await refreshFullAccessStatus();
    restoreComposerDraft(active.id);
  } else {
    updateChatRoomTrigger("暂无聊天室");
    clearChatMessagesUi("暂无聊天室");
  }
}

function clearChatMessagesUi(label = "暂无聊天记录") {
  chatMessageList()?.replaceChildren();
  messagePaging = { roomId: null, hasMore: false, nextBefore: null };
  selectedMessageIds.clear();
  updateLoadOlderButton();
  updateReferenceSelection();
  setText("chat.current", label);
  renderChatRoster([]);
  renderHandoffList([]);
}

function memoryWindowSessionId() {
  return activeSessionId || sessionRegistry.active_session_id || sessionRegistry.sessions?.[0]?.id || "";
}

function memoryWindowSessionEndpoint(suffix = "") {
  const sessionId = memoryWindowSessionId();
  if (!sessionId) {
    return "";
  }
  return `/api/sessions/${encodeURIComponent(sessionId)}${suffix}`;
}

function memoryWindowBeadEndpoint(beadId) {
  return memoryWindowSessionEndpoint(`/beads/${encodeURIComponent(beadId)}`);
}

async function loadSessionBeads(sessionId = memoryWindowSessionId()) {
  if (!sessionId) {
    memoryWindowSetBeads([], memoryWindowDeriveSummary([]));
    return [];
  }
  const response = await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/beads`);
  memoryWindowSetBeads(response.beads || [], response.summary);
  return memoryWindowBeads;
}

async function memoryWindowRefresh() {
  const beads = await loadSessionBeads();
  await memoryWindowRefreshPreviews();
  return beads;
}

function memoryWindowSetBeads(beads = [], summary = null) {
  memoryWindowBeads = Array.isArray(beads) ? beads : [];
  memoryWindowSummary = summary || memoryWindowDeriveSummary(memoryWindowBeads);
  memoryWindowPopulateFilterOptions(memoryWindowBeads);
  memoryWindowRenderInsights();
  memoryWindowRenderBeadList();
}

function memoryWindowDeriveSummary(beads = []) {
  const explicit = beads.filter((bead) => {
    const id = String(bead.id || "");
    return !id.endsWith("-person") && !id.endsWith("-task");
  }).length;
  return {
    total: beads.length,
    explicit,
    defaulted: explicit === 0 && beads.length > 0,
    pinned: beads.filter((bead) => bead.pinned).length,
    prompt_candidates: beads.filter((bead) => bead.layer !== "L4").length,
    by_layer: {},
    by_kind: {},
    max_beads: 0,
  };
}

function memoryWindowSetRoleText(role, value) {
  const node = document.querySelector(`[data-role="${role}"]`);
  if (node) {
    node.textContent = String(value ?? "-");
  }
}

function memoryWindowRenderInsights() {
  const summary = memoryWindowSummary || memoryWindowDeriveSummary(memoryWindowBeads);
  const tokenBudget = memoryWindowContextPreview?.token_budget;
  memoryWindowSetRoleText("memory-summary-total", summary.total ?? memoryWindowBeads.length);
  memoryWindowSetRoleText("memory-summary-pinned", summary.pinned ?? 0);
  memoryWindowSetRoleText("memory-summary-prompt", summary.prompt_candidates ?? 0);
  memoryWindowSetRoleText("memory-context-total", tokenBudget?.total ?? 0);
}

function memoryWindowPopulateFilterOptions(beads = []) {
  memoryWindowPopulateSelect("memory-window-kind", beads.map((bead) => bead.kind).filter(Boolean));
  memoryWindowPopulateSelect("memory-window-layer", beads.map((bead) => bead.layer).filter(Boolean));
  memoryWindowPopulateSelect("memory-window-source-filter", beads.map((bead) => bead.source || bead.origin_table).filter(Boolean));
}

function memoryWindowPopulateSelect(role, values) {
  const select = document.querySelector(`[data-role="${role}"]`);
  if (!select) {
    return;
  }
  const current = select.value;
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "全部";
  select.append(all);
  Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  select.value = Array.from(select.options).some((option) => option.value === current) ? current : "";
}

function memoryWindowFilters() {
  return {
    query: document.querySelector('[data-role="memory-window-query"]')?.value?.trim().toLowerCase() || "",
    kind: document.querySelector('[data-role="memory-window-kind"]')?.value || "",
    layer: document.querySelector('[data-role="memory-window-layer"]')?.value || "",
    pinned: document.querySelector('[data-role="memory-window-pinned"]')?.value || "",
    source: document.querySelector('[data-role="memory-window-source-filter"]')?.value || "",
  };
}

function memoryWindowApplyFilters() {
  memoryWindowSelectedBeadId = null;
  memoryWindowRenderBeadList();
  memoryWindowSchedulePreviewRefresh();
}

function memoryWindowFilteredBeads() {
  const filters = memoryWindowFilters();
  return memoryWindowBeads.filter((bead) => {
    if (filters.kind && bead.kind !== filters.kind) return false;
    if (filters.layer && bead.layer !== filters.layer) return false;
    if (filters.pinned && String(Boolean(bead.pinned)) !== filters.pinned) return false;
    const source = bead.source || bead.origin_table || "";
    if (filters.source && source !== filters.source) return false;
    if (filters.query && !memoryWindowSearchText(bead).includes(filters.query)) return false;
    return true;
  });
}

function memoryWindowSearchText(bead) {
  return [
    bead.id,
    bead.summary,
    bead.kind,
    bead.layer,
    bead.source,
    bead.origin_table,
    bead.origin_message_id,
  ].filter(Boolean).join(" ").toLowerCase();
}

function memoryWindowRenderBeadList() {
  const list = document.querySelector('[data-role="memory-bead-list"]');
  if (!list) {
    return;
  }
  list.replaceChildren();
  const visible = memoryWindowFilteredBeads();
  setText("memoryWindow.count", `${visible.length} / ${memoryWindowBeads.length} 条记忆`);
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "memory-window-empty";
    empty.textContent = memoryWindowBeads.length ? "当前筛选下没有匹配记忆。" : "暂无显式记忆。";
    list.append(empty);
    memoryWindowRenderConstellation([]);
    memoryWindowRenderDetail(null);
    return;
  }

  if (!visible.some((bead) => bead.id === memoryWindowSelectedBeadId)) {
    memoryWindowSelectedBeadId = visible[0]?.id ?? null;
  }

  visible.forEach((bead) => {
    const item = document.createElement("article");
    item.className = "memory-bead-item";
    item.dataset.beadId = bead.id;
    item.classList.toggle("is-active", bead.id === memoryWindowSelectedBeadId);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "memory-window-bead-select";
    select.dataset.action = "memory-bead-select";
    select.dataset.beadId = bead.id;

    const title = document.createElement("strong");
    title.title = bead.summary || bead.id;
    title.textContent = bead.summary || bead.id || "未命名记忆";

    const meta = document.createElement("span");
    meta.textContent = [
      bead.layer || "L?",
      bead.kind || "kind?",
      bead.pinned ? "pinned" : "",
      bead.token_count ? `${bead.token_count} tok` : "",
    ].filter(Boolean).join(" · ");

    const source = document.createElement("small");
    source.textContent = bead.source || bead.origin_table || "无来源";
    select.append(title, meta, source);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-button danger";
    button.dataset.action = "memory-bead-delete";
    button.dataset.beadId = bead.id;
    button.dataset.beadSummary = bead.summary || bead.id;
    button.title = "删除记忆";
    button.textContent = "×";
    item.append(select, button);
    list.append(item);
  });

  memoryWindowRenderConstellation(visible);
  memoryWindowRenderDetail(visible.find((bead) => bead.id === memoryWindowSelectedBeadId) || visible[0]);
}

// 记忆星状图：以当前会话为中心节点，记忆 beads 为外围星点。
// 环半径 = Layer(L1 最近/L4 最远)；颜色 = Kind；星点大小 = 置信度；pinned 高亮描边。
// 点击星点 = 选中该记忆（复用 memoryWindowSelectedBeadId）；hover 显示摘要。
const MEMORY_LAYER_RING = { L1: 0.30, L2: 0.50, L3: 0.70, L4: 0.92 };
const MEMORY_KIND_COLOR = {
  chat: "#4da3ff",
  decision: "#ffb454",
  tool: "#5fd28b",
  fact: "#c08cff",
  task: "#ff7a91",
};
function memoryConstellationColor(kind) {
  return MEMORY_KIND_COLOR[String(kind || "").toLowerCase()] || "#9aa7c7";
}
function memoryWindowRenderConstellation(beads = []) {
  const host = document.querySelector('[data-role="memory-constellation"]');
  if (!host) {
    return;
  }
  host.replaceChildren();
  if (!beads.length) {
    const empty = document.createElement("div");
    empty.className = "memory-window-empty";
    empty.textContent = "暂无记忆可视化。";
    host.append(empty);
    return;
  }
  const W = 360;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) / 2 - 26;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "memory-constellation-svg");
  svg.setAttribute("role", "img");

  // 同心环（Layer 参考线）
  ["L1", "L2", "L3", "L4"].forEach((layer) => {
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", cx);
    ring.setAttribute("cy", cy);
    ring.setAttribute("r", (MEMORY_LAYER_RING[layer] * maxR).toFixed(1));
    ring.setAttribute("class", "memory-constellation-ring");
    svg.append(ring);
  });

  // 计算每个 bead 的关联度（连接的其它消息数）：同 source 或关键词重叠≥2。
  // 关联度越高 = 价值越大 = 星点越大、越亮；关联度低 = 易被老化 = 暗淡。
  const beadKeywords = (text) => new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .flatMap((seg) => (/[一-鿿]/.test(seg) ? Array.from(seg).filter((c) => /[一-鿿]/.test(c)) : (seg.length >= 2 ? [seg] : [])))
  );
  const kwCache = beads.map((b) => beadKeywords(b.summary));
  const degreeOf = (i) => {
    let degree = 0;
    for (let j = 0; j < beads.length; j += 1) {
      if (i === j) continue;
      if (beads[i].source && beads[i].source === beads[j].source) { degree += 1; continue; }
      let shared = 0;
      kwCache[i].forEach((k) => { if (kwCache[j].has(k)) shared += 1; });
      if (shared >= 2) degree += 1;
    }
    return degree;
  };
  const degrees = beads.map((_, i) => degreeOf(i));
  const maxDegree = Math.max(1, ...degrees);
  const degreeById = new Map(beads.map((b, i) => [b.id, degrees[i]]));

  // 按 layer 分组、在各自环上均匀分布角度
  const byLayer = {};
  beads.forEach((bead) => {
    const layer = MEMORY_LAYER_RING[bead.layer] ? bead.layer : "L2";
    (byLayer[layer] = byLayer[layer] || []).push(bead);
  });

  Object.entries(byLayer).forEach(([layer, items]) => {
    const r = MEMORY_LAYER_RING[layer] * maxR;
    items.forEach((bead, index) => {
      const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const confidence = Number(bead.confidence);
      const degree = degreeById.get(bead.id) || 0;
      // 大小主要由关联度（价值）决定，置信度次之；pinned 给最小尺寸保底。
      const valueRatio = degree / maxDegree;
      const size = 4 + valueRatio * 9 + (Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5) * 3;
      // 价值越低越暗淡（提示该记忆最易被老化淘汰）；pinned 始终明亮。
      const valueOpacity = bead.pinned ? 1 : (0.45 + valueRatio * 0.55);

      // 连接中心的线
      const link = document.createElementNS(NS, "line");
      link.setAttribute("x1", cx);
      link.setAttribute("y1", cy);
      link.setAttribute("x2", x.toFixed(1));
      link.setAttribute("y2", y.toFixed(1));
      link.setAttribute("class", "memory-constellation-link");
      svg.append(link);

      const star = document.createElementNS(NS, "circle");
      star.setAttribute("cx", x.toFixed(1));
      star.setAttribute("cy", y.toFixed(1));
      star.setAttribute("r", size.toFixed(1));
      star.setAttribute("fill", memoryConstellationColor(bead.kind));
      star.setAttribute("fill-opacity", valueOpacity.toFixed(2));
      star.setAttribute("class", "memory-constellation-star");
      star.classList.toggle("is-pinned", Boolean(bead.pinned));
      star.classList.toggle("is-active", bead.id === memoryWindowSelectedBeadId);
      star.dataset.action = "memory-bead-select";
      star.dataset.beadId = bead.id;
      const tip = document.createElementNS(NS, "title");
      tip.textContent = `[${bead.layer || "L?"} · ${bead.kind || "kind?"} · 关联${degree}${bead.pinned ? " · pinned" : ""}] ${bead.summary || bead.id || ""}`;
      star.append(tip);
      svg.append(star);
    });
  });

  // 中心节点（当前会话）
  const core = document.createElementNS(NS, "circle");
  core.setAttribute("cx", cx);
  core.setAttribute("cy", cy);
  core.setAttribute("r", 14);
  core.setAttribute("class", "memory-constellation-core");
  svg.append(core);
  const coreLabel = document.createElementNS(NS, "text");
  coreLabel.setAttribute("x", cx);
  coreLabel.setAttribute("y", cy + 4);
  coreLabel.setAttribute("text-anchor", "middle");
  coreLabel.setAttribute("class", "memory-constellation-core-label");
  coreLabel.textContent = "会话";
  svg.append(coreLabel);

  host.append(svg);

  // 图例
  const legend = document.createElement("div");
  legend.className = "memory-constellation-legend";
  Object.entries(MEMORY_KIND_COLOR).forEach(([kind, color]) => {
    if (!beads.some((bead) => String(bead.kind || "").toLowerCase() === kind)) {
      return;
    }
    const tag = document.createElement("span");
    tag.className = "memory-constellation-legend-item";
    const dot = document.createElement("i");
    dot.style.background = color;
    tag.append(dot, document.createTextNode(kind));
    legend.append(tag);
  });
  if (legend.childElementCount) {
    host.append(legend);
  }
}

function memoryWindowRenderDetail(bead) {
  const detail = document.querySelector('[data-role="memory-window-detail"]');
  const source = document.querySelector('[data-role="memory-window-source"]');
  if (!detail) {
    return;
  }
  detail.replaceChildren();

  if (!bead) {
    const empty = document.createElement("div");
    empty.className = "memory-window-empty";
    empty.textContent = "选择一条记忆查看详情。";
    detail.append(empty);
    memoryWindowRenderSource(null, source);
    return;
  }

  const title = document.createElement("h2");
  title.textContent = bead.summary || bead.id || "未命名记忆";
  const summary = document.createElement("p");
  summary.className = "memory-window-summary";
  summary.textContent = bead.summary || "无摘要内容。";

  const meta = document.createElement("dl");
  meta.className = "memory-window-meta";
  memoryWindowAppendMeta(meta, "ID", bead.id || "-");
  memoryWindowAppendMeta(meta, "Kind", bead.kind || "-");
  memoryWindowAppendMeta(meta, "Layer", bead.layer || "-");
  memoryWindowAppendMeta(meta, "Pinned", bead.pinned ? "是" : "否");
  memoryWindowAppendMeta(meta, "Confidence", Number.isFinite(bead.confidence) ? bead.confidence.toFixed(2) : "-");
  memoryWindowAppendMeta(meta, "Token", bead.token_count ?? "-");
  memoryWindowAppendMeta(meta, "Created", memoryWindowTimeLabel(bead.created_at));

  const actions = document.createElement("div");
  actions.className = "memory-window-actions";
  const pinButton = document.createElement("button");
  pinButton.type = "button";
  pinButton.className = "mini-button";
  pinButton.dataset.action = "memory-bead-pin-toggle";
  pinButton.dataset.beadId = bead.id || "";
  pinButton.textContent = bead.pinned ? "Unpin" : "Pin";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "mini-button";
  editButton.dataset.action = "memory-bead-edit";
  editButton.dataset.beadId = bead.id || "";
  editButton.textContent = "Edit";
  const sourceButton = document.createElement("button");
  sourceButton.type = "button";
  sourceButton.className = "mini-button";
  sourceButton.disabled = true;
  sourceButton.textContent = "来源见右侧";
  actions.append(pinButton, editButton, sourceButton);

  detail.append(title, summary, meta, actions);
  memoryWindowRenderSource(bead, source);
}

function memoryWindowAppendMeta(list, label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value == null || value === "" ? "-" : String(value);
  list.append(dt, dd);
}

function memoryWindowRenderSource(bead, source) {
  if (!source) {
    return;
  }
  const body = source.querySelector(".memory-window-source-body") || source;
  body.replaceChildren();
  if (!bead) {
    body.textContent = "暂无选中来源。";
    return;
  }
  const list = document.createElement("dl");
  list.className = "memory-window-meta";
  memoryWindowAppendMeta(list, "Source", bead.source || "-");
  memoryWindowAppendMeta(list, "Origin table", bead.origin_table || "-");
  memoryWindowAppendMeta(list, "Origin message", bead.origin_message_id || "-");
  memoryWindowAppendMeta(list, "Goal phase", bead.origin_table === "goal_phases" ? bead.origin_message_id || "待接入" : "非 Goal 来源");
  body.append(list);
}

function memoryWindowSchedulePreviewRefresh() {
  if (memoryWindowPreviewTimer) {
    window.clearTimeout(memoryWindowPreviewTimer);
  }
  memoryWindowPreviewTimer = window.setTimeout(() => {
    memoryWindowPreviewTimer = null;
    memoryWindowRefreshPreviews().catch((error) => {
      memoryWindowRenderPromptPreview(null, `Prompt preview failed: ${error.message}`);
      memoryWindowRenderContextPreview(null, `Context preview failed: ${error.message}`);
    });
  }, 180);
}

async function memoryWindowRefreshPreviews() {
  const endpoint = memoryWindowSessionEndpoint();
  if (!endpoint) {
    memoryWindowSummary = memoryWindowDeriveSummary([]);
    memoryWindowPromptPreview = null;
    memoryWindowContextPreview = null;
    memoryWindowRenderPromptPreview(null);
    memoryWindowRenderContextPreview(null);
    memoryWindowRenderInsights();
    return;
  }
  const filters = memoryWindowFilters();
  const selected = memoryWindowBeads.find((bead) => bead.id === memoryWindowSelectedBeadId);
  const promptParams = new URLSearchParams({ prompt_only: "true", limit: "8" });
  if (filters.query) promptParams.set("q", filters.query);
  if (filters.kind) promptParams.set("kind", filters.kind);
  if (filters.layer) promptParams.set("layer", filters.layer);
  const contextParams = new URLSearchParams();
  if (activeChatRoomId) contextParams.set("room_id", activeChatRoomId);
  const contextPrompt = filters.query || selected?.summary || "";
  if (contextPrompt) contextParams.set("prompt", contextPrompt);
  const [summaryResponse, promptResponse, contextResponse] = await Promise.all([
    requestJson(`${endpoint}/beads/summary`),
    requestJson(`${endpoint}/beads/prompt?${promptParams.toString()}`),
    requestJson(`${endpoint}/context-preview${contextParams.size ? `?${contextParams.toString()}` : ""}`),
  ]);
  memoryWindowSummary = summaryResponse.summary || memoryWindowDeriveSummary(memoryWindowBeads);
  memoryWindowPromptPreview = promptResponse;
  memoryWindowContextPreview = contextResponse;
  memoryWindowRenderPromptPreview(memoryWindowPromptPreview);
  memoryWindowRenderContextPreview(memoryWindowContextPreview);
  memoryWindowRenderInsights();
}

function memoryWindowRenderPromptPreview(response, fallback = "No prompt memory selected.") {
  const node = document.querySelector('[data-role="memory-prompt-preview"]');
  if (!node) {
    return;
  }
  if (!response) {
    node.textContent = fallback;
    return;
  }
  const beadLines = (response.beads || [])
    .map((bead, index) => `${index + 1}. [${bead.layer || "L?"}/${bead.kind || "note"}] ${bead.summary || bead.id}`)
    .join("\n");
  node.textContent = [
    response.context ? `Context block:\n${response.context}` : "",
    beadLines ? `Selected beads:\n${beadLines}` : "Selected beads: none",
  ].filter(Boolean).join("\n\n").slice(0, 2400);
}

function memoryWindowRenderContextPreview(response, fallback = "No context preview.") {
  const node = document.querySelector('[data-role="memory-context-preview"]');
  if (!node) {
    return;
  }
  if (!response) {
    node.textContent = fallback;
    return;
  }
  const budget = response.token_budget || {};
  const messages = Array.isArray(response.messages) ? response.messages.length : 0;
  const beads = Array.isArray(response.memory_beads) ? response.memory_beads.length : 0;
  const systemSnippet = String(response.system_prompt || "").slice(0, 500);
  node.textContent = [
    `messages=${messages} history=${response.history_message_count ?? 0} memory_beads=${beads}`,
    `tokens total=${budget.total ?? 0}/${budget.budget ?? 0} system=${budget.system ?? 0} memory=${budget.memory ?? 0} history=${budget.history ?? 0} user=${budget.user ?? 0}`,
    `truncated=${Boolean(response.truncated)}`,
    systemSnippet ? `system:\n${systemSnippet}` : "",
  ].filter(Boolean).join("\n").slice(0, 2400);
}

function memoryWindowTimeLabel(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) {
    return "-";
  }
  const millis = raw < 10_000_000_000 ? raw * 1000 : raw;
  return new Date(millis).toLocaleString("zh-CN", { hour12: false });
}

async function onMemoryBeadListClick(event) {
  return beadListClick(event);
}

async function beadListClick(event) {
  const select = event.target.closest('[data-action="memory-bead-select"]');
  if (select?.dataset.beadId) {
    memoryWindowSelectedBeadId = select.dataset.beadId;
    memoryWindowRenderBeadList();
    memoryWindowSchedulePreviewRefresh();
    return;
  }

  const pinButton = event.target.closest('[data-action="memory-bead-pin-toggle"]');
  if (pinButton?.dataset.beadId) {
    const bead = memoryWindowBeads.find((item) => item.id === pinButton.dataset.beadId);
    await memoryWindowPatchBead(pinButton, pinButton.dataset.beadId, { pinned: !Boolean(bead?.pinned) });
    return;
  }

  const editButton = event.target.closest('[data-action="memory-bead-edit"]');
  if (editButton?.dataset.beadId) {
    const bead = memoryWindowBeads.find((item) => item.id === editButton.dataset.beadId);
    const nextSummary = window.prompt("Edit memory summary", bead?.summary || "");
    if (nextSummary == null) {
      return;
    }
    const summary = nextSummary.trim();
    if (!summary) {
      addMessage({ author: "记忆", text: "记忆摘要不能为空。", kind: "thought", icon: "error-log" });
      return;
    }
    await memoryWindowPatchBead(editButton, editButton.dataset.beadId, { summary });
    return;
  }

  const button = event.target.closest('[data-action="memory-bead-delete"]');
  if (!button?.dataset.beadId) {
    return;
  }
  const summary = button.dataset.beadSummary || button.dataset.beadId;
  const ok = window.confirm(`确认删除这条记忆？\n\n${summary}`);
  if (!ok) {
    return;
  }
  setBusy(button, true, "…");
  try {
    const endpoint = memoryWindowBeadEndpoint(button.dataset.beadId);
    if (!endpoint) {
      throw new Error("没有可用的会话");
    }
    const response = await requestJson(endpoint, { method: "DELETE" });
    if (memoryWindowSelectedBeadId === button.dataset.beadId) {
      memoryWindowSelectedBeadId = response.beads?.[0]?.id ?? null;
    }
    memoryWindowSetBeads(response.beads || [], response.summary);
    await memoryWindowRefreshPreviews();
  } catch (error) {
    addMessage({ author: "记忆", text: `删除记忆失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function memoryWindowPatchBead(button, beadId, payload) {
  setBusy(button, true, "...");
  try {
    const endpoint = memoryWindowBeadEndpoint(beadId);
    if (!endpoint) {
      throw new Error("没有可用的会话");
    }
    const response = await requestJson(endpoint, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    memoryWindowSelectedBeadId = beadId;
    memoryWindowSetBeads(response.beads || [], response.summary);
    await memoryWindowRefreshPreviews();
    if (payload?.pinned === true) {
      pulseWorkbenchMotionState("memory", WORKBENCH_MOTION_STATES.memory, 1050);
    }
  } catch (error) {
    addMessage({ author: "记忆", text: `记忆更新失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function browserProxyLoad() {
  try {
    const config = await requestJson("/api/browser/proxy");
    browserProxyRender(config);
  } catch (error) {
    browserProxyStatus(`Proxy load failed: ${error.message}`);
  }
}

function browserProxyRender(config = {}) {
  const system = document.querySelector('[data-role="browser-proxy-system"]');
  const proxy = document.querySelector('[data-role="browser-proxy-url"]');
  const bypass = document.querySelector('[data-role="browser-proxy-bypass"]');
  if (system) {
    system.checked = config.use_system_proxy !== false;
  }
  if (proxy) {
    proxy.value = config.proxy_url || "";
  }
  if (bypass) {
    bypass.value = config.bypass_list || "";
  }
  browserRuntimeConfig.browser.search_engine_url = config.search_engine_url || DEFAULT_BROWSER_SEARCH_ENGINE_URL;
  const hint = config.webview2_args_hint || (config.use_system_proxy ? "system proxy" : "direct");
  browserProxyStatus(hint);
}

function browserProxyStatus(text) {
  const status = document.querySelector('[data-role="browser-proxy-status"]');
  if (status) {
    status.textContent = text || "";
  }
}

async function browserProxySave(event) {
  const button = event?.currentTarget || actionButtons.get("browser-proxy-save");
  setBusy(button, true, "Saving");
  try {
    const result = await requestJson("/api/browser/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        use_system_proxy: document.querySelector('[data-role="browser-proxy-system"]')?.checked !== false,
        proxy_url: document.querySelector('[data-role="browser-proxy-url"]')?.value || null,
        bypass_list: document.querySelector('[data-role="browser-proxy-bypass"]')?.value || null,
      }),
    });
    browserProxyRender(result);
  } catch (error) {
    browserProxyStatus(`Proxy save failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

function browserWindowNormalizeTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "about:blank";
  }
  if (/^(https?:|file:|about:)/i.test(value)) {
    return value;
  }
  const ipv6Loopback = value.match(/^::1(?::(\d+))?([/?#].*)?$/i);
  if (ipv6Loopback) {
    return `http://[::1]${ipv6Loopback[1] ? `:${ipv6Loopback[1]}` : ""}${ipv6Loopback[2] || ""}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value) || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/:?#].*)?$/i.test(value)) {
    return `http://${value}`;
  }
  const template = browserRuntimeConfig.browser.search_engine_url || DEFAULT_BROWSER_SEARCH_ENGINE_URL;
  const encoded = encodeURIComponent(value);
  if (template.includes("{query}")) {
    return template.replaceAll("{query}", encoded);
  }
  const separator = template.includes("?") ? "&" : "?";
  return `${template}${separator}q=${encoded}`;
}

// 取 Tauri invoke（仅桌面壳内、远程页面被授权时存在）；非 Tauri 环境返回 null。
function tauriInvoke() {
  return window.__TAURI__?.core?.invoke || null;
}

function browserWindowIsLoopback(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#].*)?$/i.test(url);
  }
}

function browserWindowClassifyTarget(url) {
  const value = String(url || "").trim();
  if (/^(about:|file:)/i.test(value)) {
    return "iframePreview";
  }
  if (/^https?:/i.test(value)) {
    return browserWindowIsLoopback(value) ? "iframePreview" : "systemBrowser";
  }
  return "iframePreview";
}

function browserWindowElements() {
  return {
    input: document.querySelector('[data-role=browser-window-input]'),
    frame: document.querySelector('[data-role=browser-window-frame]'),
    status: document.querySelector('[data-role=browser-window-status]'),
  };
}

function browserWindowSetStatus(text) {
  const status = document.querySelector('[data-role=browser-window-status]');
  if (status) {
    status.textContent = text || "";
  }
}

function browserCommandPayload(name, url) {
  return name === "Navigate" ? { Navigate: { url } } : name;
}

async function browserWindowInvokeCommand(name, url) {
  const invoke = tauriInvoke();
  if (!invoke) {
    throw new Error("Tauri invoke unavailable");
  }
  return invoke("browser_window_command", {
    command: browserCommandPayload(name, url),
  });
}

async function browserWindowOpenSystem(url) {
  try {
    await requestJson('/api/browser/open-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return "system";
  } catch (error) {
    console.warn('系统浏览器打开失败，降级 window.open', error);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return "popup";
}

const browserHosts = {
  iframePreview: {
    async open(url) {
      return this.navigate(url);
    },
    async navigate(url) {
      const { frame, status } = browserWindowElements();
      if (!frame) {
        return { opened: "none" };
      }
      frame.dataset.currentUrl = url;
      if (/^https?:/i.test(url)) {
        if (status) {
          status.textContent = `正在探测是否可内嵌：${url} …`;
        }
        let embeddable = false;
        let reason = "";
        try {
          const probe = await requestJson('/api/browser/embeddable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          embeddable = probe.embeddable === true;
          reason = probe.reason || "";
        } catch (error) {
          embeddable = false;
          reason = error.message || "探测失败";
        }
        if (!embeddable) {
          frame.src = 'about:blank';
          if (status) {
            status.textContent = `${url} 不可内嵌${reason ? `（${reason}）` : ''}。请点“独立窗口”。`;
          }
          return { opened: "blocked", reason };
        }
      }
      frame.src = url;
      if (status) {
        status.textContent = url === 'about:blank' ? '' : `已在主面板内嵌：${url}`;
      }
      return { opened: "iframe" };
    },
    back() {
      const { frame, status } = browserWindowElements();
      try {
        frame?.contentWindow?.history?.back();
      } catch {
        if (status) {
          status.textContent = "嵌入页面不允许访问 history，无法后退。";
        }
      }
    },
    forward() {
      const { frame, status } = browserWindowElements();
      try {
        frame?.contentWindow?.history?.forward();
      } catch {
        if (status) {
          status.textContent = "嵌入页面不允许访问 history，无法前进。";
        }
      }
    },
    reload() {
      const { frame } = browserWindowElements();
      if (frame?.src) {
        frame.src = frame.src;
      }
    },
    stop() {
      try {
        browserWindowElements().frame?.contentWindow?.stop?.();
      } catch {
        // Cross-origin iframes may reject stop; safe no-op.
      }
    },
    focus() {
      browserWindowElements().frame?.focus?.();
    },
    close() {
      const { frame } = browserWindowElements();
      if (frame) {
        frame.src = "about:blank";
        delete frame.dataset.currentUrl;
      }
    },
  },
  tauriWebview2: {
    async open(url) {
      return this.navigate(url);
    },
    async navigate(url) {
      try {
        await browserWindowInvokeCommand("Navigate", url);
        browserWindowSetStatus(`已用独立浏览器窗口打开：${url}`);
        return { opened: "tauri" };
      } catch (error) {
        console.warn('browser_window_command Navigate 失败，降级系统浏览器', error);
        const opened = await browserHosts.systemBrowser.open(url);
        return { opened };
      }
    },
    async back() {
      try { await browserWindowInvokeCommand("Back"); } catch { /* no-op */ }
    },
    async forward() {
      try { await browserWindowInvokeCommand("Forward"); } catch { /* no-op */ }
    },
    async reload() {
      try { await browserWindowInvokeCommand("Reload"); } catch { /* no-op */ }
    },
    async stop() {
      try { await browserWindowInvokeCommand("Stop"); } catch { /* no-op */ }
    },
    async focus() {
      try { await browserWindowInvokeCommand("Focus"); } catch { /* no-op */ }
    },
    async close() {
      try { await browserWindowInvokeCommand("Close"); } catch { /* no-op */ }
    },
  },
  systemBrowser: {
    async open(url) {
      return browserWindowOpenSystem(url);
    },
    async navigate(url) {
      return this.open(url);
    },
    back() {},
    forward() {},
    reload() {},
    stop() {},
    focus() {},
    close() {},
  },
};

function browserOpenedHowLabel(how) {
  return how === 'tauri' ? '独立浏览器窗口' : how === 'system' ? '系统默认浏览器' : how === 'blocked' ? '主面板' : '新标签页';
}

async function browserWindowOpenIndependent(url) {
  const result = await browserHosts.tauriWebview2.open(url);
  return result.opened || result;
}

async function browserWindowNavigate() {
  const { input, frame } = browserWindowElements();
  const url = browserWindowNormalizeTarget(input?.value);
  if (!frame) {
    return;
  }
  pulseWorkbenchMotionState("browser", WORKBENCH_MOTION_STATES.browser, 1450);
  if (input) {
    input.value = url === 'about:blank' ? '' : url;
  }
  frame.dataset.currentUrl = url;
  activeBrowserHostName = browserWindowClassifyTarget(url);
  const result = await browserHosts[activeBrowserHostName].navigate(url);
  if (result?.opened && result.opened !== "iframe") {
    browserWindowSetStatus(`已用${browserOpenedHowLabel(result.opened)}打开：${url}`);
  }
}

function browserWindowReload() {
  browserHosts[activeBrowserHostName]?.reload?.();
}

function browserWindowBack() {
  browserHosts[activeBrowserHostName]?.back?.();
}

function browserWindowForward() {
  browserHosts[activeBrowserHostName]?.forward?.();
}

function browserWindowStop() {
  browserHosts[activeBrowserHostName]?.stop?.();
}

async function browserWindowOpenExternal() {
  const input = document.querySelector('[data-role="browser-window-input"]');
  const frame = document.querySelector('[data-role="browser-window-frame"]');
  const status = document.querySelector('[data-role="browser-window-status"]');
  const url = frame?.dataset.currentUrl || browserWindowNormalizeTarget(input?.value);
  if (!url || url === "about:blank") {
    return;
  }
  const how = await browserWindowOpenIndependent(url);
  if (status) {
    status.textContent = `已用${browserOpenedHowLabel(how)}打开：${url}`;
  }
}

// Static contract sample: browserWindowClassifyTarget("https://www.baidu.com") === "systemBrowser";
// Static contract sample: browserWindowClassifyTarget("http://127.0.0.1:8765/health") === "iframePreview";

function terminalWindowOutcomeText(outcome = {}, pendingCallId = "") {
  let payload = outcome.output;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Keep plain command output as-is.
    }
  }
  const outputText = typeof payload === "string"
    ? payload
    : payload?.stdout || payload?.output || payload?.stderr || "";
  const gate = outcome.permission_gate?.decision || "unknown";
  const lines = [
    `$ status: ${outcome.status || "unknown"} · ${outcome.elapsed_ms ?? 0}ms · permission: ${gate}`,
  ];
  if (outputText) {
    lines.push(String(outputText).trimEnd());
  } else if (outcome.summary_text) {
    lines.push(outcome.summary_text);
  }
  if (pendingCallId) {
    lines.push(`[pending approval] ${pendingCallId}`);
  }
  return lines.join("\n\n");
}

async function terminalWindowRunPowerShell() {
  const command = document.querySelector('[data-role="terminal-command"]')?.value?.trim();
  const output = document.querySelector('[data-role="terminal-window-output"]');
  const raw = document.querySelector('[data-role="terminal-window-raw"]');
  if (!command) {
    if (output) output.textContent = "Please enter a PowerShell command.";
    return;
  }
  const timeout = Number(document.querySelector('[data-role="terminal-timeout-ms"]')?.value || 30000);
  const button = actionButtons.get("terminal-window-run");
  setBusy(button, true, "Running");
  output?.classList.add("is-running");
  setWorkbenchMotionState("terminal", WORKBENCH_MOTION_STATES.terminal, true);
  try {
    const response = await requestJson("/api/tools/runtime-execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool_name: "PowerShell",
        input: {
          command,
          timeout_ms: Number.isFinite(timeout) ? timeout : 30000,
        },
        session_id: activeSessionId,
      }),
    });
    if (output) {
      output.textContent = terminalWindowOutcomeText(response.outcome, response.pending_call_id);
    }
    if (raw) {
      raw.textContent = JSON.stringify(response, null, 2);
    }
    await taskRefreshWindow();
  } catch (error) {
    if (output) {
      output.textContent = `PowerShell failed: ${error.message}`;
    }
    if (raw) {
      raw.textContent = String(error?.stack || error?.message || error);
    }
  } finally {
    output?.classList.remove("is-running");
    setWorkbenchMotionState("terminal", WORKBENCH_MOTION_STATES.terminal, false);
    setBusy(button, false);
  }
}

async function terminalWindowRun() {
  return terminalWindowRunPowerShell();
}

function terminalWindowClear() {
  const output = document.querySelector('[data-role="terminal-window-output"]');
  const raw = document.querySelector('[data-role="terminal-window-raw"]');
  if (output) {
    output.textContent = "PowerShell output cleared.";
  }
  if (raw) {
    raw.textContent = "No execution yet.";
  }
}

async function loadChatRoomMessages(roomId, { before = null, appendOlder = false } = {}) {
  const url = new URL(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, location.origin);
  url.searchParams.set("limit", "80");
  if (before) {
    url.searchParams.set("before", before);
  }
  const response = await requestJson(url.pathname + url.search);
  const list = chatMessageList();
  if (!list) {
    return;
  }

  const previousScrollHeight = list.scrollHeight;
  if (!appendOlder) {
    list.replaceChildren();
  }

  const visibleMessages = (response.messages || []).filter(shouldRenderCompletedMessage);
  const messages = appendOlder ? [...visibleMessages].reverse() : visibleMessages;
  messages.forEach((message) => {
    addMessage({
      id: message.id,
      author: message.author,
      text: message.content,
      kind: kindForMessage(message),
      icon: iconForMessage(message),
      attachments: message.attachments,
      createdAt: message.created_at,
      prepend: appendOlder,
    });
    // 历史里仍是 pending 的视频消息（job 还在生成、未持久化前）：继续轮询，完成后替换为视频。
    if (message.kind === "assistant-video-pending") {
      scheduleVideoPolling(message.id);
    }
  });

  messagePaging = {
    roomId,
    hasMore: response.has_more,
    nextBefore: response.next_before,
  };
  updateLoadOlderButton();

  if (appendOlder) {
    list.scrollTop = list.scrollHeight - previousScrollHeight;
  }
  selectedMessageIds.clear();
  updateReferenceSelection();
  setText("chat.current", response.room.name);
  if (!appendOlder) {
    await refreshChatCollaboration(roomId);
  }
}

async function refreshChatCollaboration(roomId = activeChatRoomId) {
  if (!roomId) {
    chatRoster = { room_id: null, members: [] };
    chatHandoffs = [];
    renderChatRoster([]);
    renderHandoffList([]);
    taskRenderHandoffSummary([]);
    return;
  }
  try {
    const rosterUrl = new URL(`/api/chat/rooms/${encodeURIComponent(roomId)}/roster`, location.origin);
    if (activeSessionId) {
      rosterUrl.searchParams.set("me", activeSessionId);
    }
    const [roster, handoffs] = await Promise.all([
      requestJson(rosterUrl.pathname + rosterUrl.search),
      requestJson(`/api/chat/rooms/${encodeURIComponent(roomId)}/handoffs?limit=20`),
    ]);
    chatRoster = roster ?? { room_id: roomId, members: [] };
    chatHandoffs = handoffs?.handoffs ?? [];
    renderChatRoster(chatRoster.members ?? []);
    renderHandoffList(chatHandoffs);
  } catch (error) {
    chatRoster = { room_id: roomId, members: [] };
    chatHandoffs = [];
    renderChatRoster([]);
    renderHandoffList([]);
    taskRenderHandoffSummary([]);
    const status = document.querySelector('[data-role="handoff-status"]');
    if (status) {
      status.textContent = `加载失败：${error.message}`;
    }
  }
}

function renderChatRoster(members = []) {
  const strip = document.querySelector('[data-role="chat-roster"]');
  if (!strip) {
    return;
  }
  strip.replaceChildren();
  if (!members.length) {
    const empty = document.createElement("span");
    empty.className = "chat-roster-empty";
    empty.textContent = "无可转交 Agent";
    strip.append(empty);
    return;
  }
  members.forEach((member) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-roster-chip chip-channel";
    chip.dataset.sessionId = member.session_id;
    chip.disabled = !member.available;
    chip.title = `${member.display_name || member.name} / ${member.provider || "-"} / ${member.model || "-"}`;
    const session = sessionById(member.session_id);
    const avatarPath = avatarForSession(session);
    if (avatarPath) {
      chip.style.setProperty("--channel-theme", avatarThemeForPath(avatarPath));
    }
    const img = document.createElement("img");
    img.src = avatarPath ? avatarUrl(avatarPath) : defaultIconUrlForSession(session || member);
    img.alt = "";
    chip.append(img);
    const label = document.createElement("span");
    label.className = "chat-roster-label";
    const name = document.createElement("b");
    name.textContent = `${member.name}${member.available ? "" : " 离线"}`;
    const model = document.createElement("small");
    model.textContent = member.model || member.provider || "-";
    label.append(name, model);
    chip.append(label);
    chip.addEventListener("click", () => {
      setSingleAgentTarget(member.session_id);
    });
    strip.append(chip);
  });
}

function renderHandoffList(handoffs = []) {
  const list = document.querySelector('[data-role="handoff-list"]');
  const status = document.querySelector('[data-role="handoff-status"]');
  if (status) {
    status.textContent = `${handoffs.length} 条`;
  }
  taskRenderHandoffSummary(handoffs);
  if (!list) {
    return;
  }
  list.replaceChildren();
  if (!handoffs.length) {
    const empty = document.createElement("div");
    empty.className = "handoff-empty";
    empty.textContent = "暂无任务链";
    list.append(empty);
    return;
  }
  handoffs.forEach((handoff) => {
    const item = document.createElement("article");
    item.className = `handoff-item is-${handoff.status || "unknown"}`;
    const title = document.createElement("strong");
    title.textContent = `${agentLabel(handoff.from_agent_id)} -> ${agentLabel(handoff.to_agent_id)}`;
    const meta = document.createElement("small");
    meta.textContent = `${handoff.status || "-"} / depth ${handoff.depth ?? 0}`;
    const text = document.createElement("p");
    text.textContent = handoff.intent || "";
    item.append(title, meta, text);
    if (handoff.rejected_reason) {
      const reason = document.createElement("em");
      reason.textContent = handoff.rejected_reason;
      item.append(reason);
    }
    list.append(item);
  });
}

function toggleHandoffDrawer() {
  handoffDrawerOpen = !handoffDrawerOpen;
  const drawer = document.querySelector('[data-role="handoff-drawer"]');
  if (drawer) {
    drawer.hidden = !handoffDrawerOpen;
  }
  if (handoffDrawerOpen) {
    refreshChatCollaboration(activeChatRoomId);
  }
}

async function manualHandoffSelectedMessages() {
  if (!activeChatRoomId || !activeSessionId) {
    return;
  }
  if (!chatRoster.members?.length) {
    await refreshChatCollaboration(activeChatRoomId);
  }
  const target = preferredHandoffTarget();
  if (!target) {
    addMessage({ author: "任务链", text: "没有可转交的目标 Agent", kind: "thought", icon: "error-log" });
    return;
  }
  const selectedCount = selectedMessageIds.size;
  const defaultIntent = selectedCount
    ? `请接手这 ${selectedCount} 条已选历史并继续处理。`
    : "请接手当前任务并继续处理。";
  const intent = window.prompt("请输入转交任务", defaultIntent)?.trim();
  if (!intent) {
    return;
  }
  const payload = {
    from_agent_id: activeSessionId,
    to: target.session_id,
    intent,
    attach: selectedCount ? "message_ids" : "last_assistant",
    attach_message_ids: Array.from(selectedMessageIds),
  };
  const button = actionButtons.get("chat-handoff-manual");
  setBusy(button, true, "转交中");
  try {
    const response = await requestJson(`/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/handoffs/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.inbound_message) {
      upsertMessage(response.inbound_message);
    } else if (response.handoff?.rejected_reason) {
      addMessage({
        author: "任务链",
        text: `转交被拦截：${response.handoff.rejected_reason}`,
        kind: "thought",
        icon: "error-log",
      });
    }
    handoffDrawerOpen = true;
    const drawer = document.querySelector('[data-role="handoff-drawer"]');
    if (drawer) {
      drawer.hidden = false;
    }
    selectedMessageIds.clear();
    document.querySelectorAll(".message.is-selected").forEach((node) => node.classList.remove("is-selected"));
    updateReferenceSelection();
    await refreshChatCollaboration(activeChatRoomId);
  } catch (error) {
    addMessage({ author: "任务链", text: `转交失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

function preferredHandoffTarget() {
  const members = (chatRoster.members || []).filter((member) => member.available);
  const selectedTargets = getSelectedAgentIds().filter((id) => id !== activeSessionId);
  const selected = members.find((member) => selectedTargets.includes(member.session_id));
  if (selected) {
    return selected;
  }
  if (members.length === 1) {
    return members[0];
  }
  if (!members.length) {
    return null;
  }
  const hint = members.map((member) => `${member.name} (${member.session_id})`).join("\n");
  const raw = window.prompt(`请输入目标 Agent 名称或 ID：\n${hint}`, members[0].name)?.trim();
  if (!raw) {
    return null;
  }
  const needle = raw.toLowerCase();
  return members.find((member) => (
    member.session_id.toLowerCase() === needle
    || member.name.toLowerCase() === needle
    || String(member.display_name || "").toLowerCase().includes(needle)
  )) ?? null;
}

function agentLabel(agentId) {
  const session = sessionRegistry.sessions?.find((item) => item.id === agentId);
  if (session) {
    return session.name || session.display_name || agentId;
  }
  const agent = agentRegistry.agents?.find((item) => item.id === agentId);
  return agent?.name || agentId;
}

async function loadOlderMessages() {
  if (!messagePaging.hasMore || !messagePaging.nextBefore || !messagePaging.roomId) {
    return;
  }
  const button = actionButtons.get("message-load-older");
  setBusy(button, true, "加载中");
  try {
    await loadChatRoomMessages(messagePaging.roomId, {
      before: messagePaging.nextBefore,
      appendOlder: true,
    });
  } catch (error) {
    addMessage({
      author: "会话管理",
      text: `加载历史失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
    updateLoadOlderButton();
  }
}

function updateLoadOlderButton() {
  const button = actionButtons.get("message-load-older");
  if (!button) {
    return;
  }
  button.disabled = !messagePaging.hasMore;
  button.classList.toggle("is-disabled", !messagePaging.hasMore);
  if (!messagePaging.hasMore) {
    button.textContent = "无更早历史";
  } else {
    button.textContent = "加载更早";
  }
}

function onComposerFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  files.forEach((file) => {
    pendingFileAttachments.push(attachmentFromFile(file, "local-file"));
  });
  event.target.value = "";
  renderComposerAttachments();
}

function onComposerPaste(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const images = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!images.length) {
    return;
  }
  event.preventDefault();
  images.forEach((file, index) => {
    pendingFileAttachments.push(attachmentFromFile(file, "pasted-image", pastedImageName(file, index)));
  });
  renderComposerAttachments();
}

function attachmentFromFile(file, source, fallbackName = "附件") {
  const name = file.name || fallbackName;
  const url = URL.createObjectURL(file);
  return {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: attachmentKindForFile(file),
    name,
    url,
    mime_type: file.type || mimeForExtension(name),
    size: file.size,
    last_modified: file.lastModified || null,
    file,
    source,
    local_object_url: true,
  };
}

function pastedImageName(file, index) {
  const mimeExt = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  }[file.type] || "png";
  return `pasted-image-${Date.now()}-${index + 1}.${mimeExt}`;
}

function onComposerAttachmentClick(event) {
  const removeButton = event.target.closest("[data-remove-attachment]");
  if (!removeButton) {
    return;
  }
  const id = removeButton.dataset.removeAttachment;
  const index = pendingFileAttachments.findIndex((attachment) => attachment.id === id);
  if (index === -1) {
    return;
  }
  if (pendingFileAttachments[index].local_object_url) {
    URL.revokeObjectURL(pendingFileAttachments[index].url);
  }
  pendingFileAttachments.splice(index, 1);
  renderComposerAttachments();
}

function renderComposerAttachments() {
  const host = document.querySelector('[data-role="composer-attachments"]');
  if (!host) {
    return;
  }
  host.replaceChildren();
  pendingFileAttachments.forEach((attachment) => {
    const chip = document.createElement("span");
    chip.className = "composer-attachment-chip";
    chip.title = `${attachment.name} (${formatFileSize(attachment.size)})`;
    const kind = attachmentKindForAttachment(attachment);
    const icon = document.createElement("img");
    icon.className = "composer-attachment-kind-icon";
    icon.alt = "";
    icon.src = attachmentIconForKind(kind);

    const name = document.createElement("span");
    name.className = "composer-attachment-name";
    name.textContent = attachment.name;

    const meta = document.createElement("span");
    meta.className = "composer-attachment-meta";
    meta.textContent = formatFileSize(attachment.size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "composer-attachment-remove";
    remove.dataset.removeAttachment = attachment.id;
    remove.setAttribute("aria-label", `移除附件 ${attachment.name}`);
    remove.textContent = "×";

    chip.append(icon, name, meta, remove);
    host.append(chip);
  });
  host.hidden = pendingFileAttachments.length === 0;
}

function clearComposerAttachments() {
  pendingFileAttachments.forEach((attachment) => {
    if (attachment.local_object_url) {
      URL.revokeObjectURL(attachment.url);
    }
  });
  pendingFileAttachments.length = 0;
  renderComposerAttachments();
}

function onComposerReferenceClick(event) {
  const clear = event.target.closest("[data-reference-clear]");
  if (!clear) {
    return;
  }
  selectedMessageIds.clear();
  document.querySelectorAll(".message.is-selected").forEach((node) => node.classList.remove("is-selected"));
  updateReferenceSelection();
}

function updateReferenceSelection() {
  setText("chat.selected", `${selectedMessageIds.size} 条已选历史`);
  renderComposerReferences();
}

function renderComposerReferences() {
  const host = document.querySelector('[data-role="composer-references"]');
  if (!host) {
    return;
  }
  host.innerHTML = "";
  if (selectedMessageIds.size === 0) {
    host.hidden = true;
    return;
  }
  const chip = document.createElement("span");
  chip.className = "composer-reference-chip";
  const selected = Array.from(selectedMessageIds)
    .slice(0, 3)
    .map((id) => {
      const node = document.querySelector(`.message[data-message-id="${CSS.escape(id)}"]`);
      const author = node?.querySelector("strong")?.textContent?.trim() || id;
      const text = node?.querySelector('[data-role="message-content"]')?.textContent?.trim() || "";
      return `${author}: ${text.slice(0, 48)}${text.length > 48 ? "..." : ""}`;
    });
  chip.textContent = `引用 ${selectedMessageIds.size} 条历史 ${selected.join(" | ")}`;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "composer-reference-clear";
  clear.dataset.referenceClear = "1";
  clear.title = "清除引用";
  clear.setAttribute("aria-label", "清除引用");
  clear.textContent = "×";
  host.append(chip, clear);
  host.hidden = false;
}

function composerAttachmentsForPayload() {
  return pendingFileAttachments.map(composerAttachmentForPayload);
}

function composerAttachmentForPayload(attachment) {
  const { id, file, source, local_object_url, size, last_modified, ...payload } = attachment;
  return { ...payload };
}

async function uploadComposerAttachments() {
  const uploaded = [];
  for (const attachment of pendingFileAttachments) {
    if (!attachment.file || !attachment.local_object_url) {
      uploaded.push(composerAttachmentForPayload(attachment));
      continue;
    }
    const formData = new FormData();
    formData.append("file", attachment.file, attachment.name);
    formData.append("name", attachment.name);
    formData.append("kind", attachment.kind);
    if (attachment.mime_type) {
      formData.append("mime_type", attachment.mime_type);
    }
    if (activeChatRoomId) {
      formData.append("room_id", activeChatRoomId);
    }
    formData.append("source", attachment.source || "local-file");
    const result = await requestJson("/api/attachments/upload", {
      method: "POST",
      body: formData,
    });
    if (!result.attachment?.url) {
      throw new Error("附件上传返回异常");
    }
    uploaded.push(result.attachment);
  }
  return uploaded;
}

function composerDraftKey(roomId = activeChatRoomId) {
  return `${composerDraftPrefix}${activeWorkspaceKey}.${roomId || "default"}`;
}

function composerDraftWorkspaceKey(workspace) {
  const raw = String(workspace || "default").trim() || "default";
  try {
    return encodeURIComponent(raw).slice(0, 180) || "default";
  } catch {
    return "default";
  }
}

function saveComposerDraft() {
  const input = document.querySelector('[data-role="message-input"]');
  if (!input) {
    return;
  }
  try {
    const key = composerDraftKey();
    if (input.value.trim()) {
      localStorage.setItem(key, input.value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("草稿保存失败:", error);
  }
}

function restoreComposerDraft(roomId = activeChatRoomId) {
  const input = document.querySelector('[data-role="message-input"]');
  if (!input) {
    return;
  }
  try {
    input.value = localStorage.getItem(composerDraftKey(roomId)) || "";
  } catch (error) {
    console.warn("草稿恢复失败:", error);
  }
}

function clearComposerDraft(roomId = activeChatRoomId) {
  try {
    localStorage.removeItem(composerDraftKey(roomId));
  } catch (error) {
    console.warn("草稿清理失败:", error);
  }
}

function attachmentKindForFile(file) {
  const kind = attachmentKindForAttachment({
    kind: "file",
    mime_type: file.type,
    url: file.name,
  });
  return kind || "file";
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function createChatRoom() {
  const button = actionButtons.get("chat-room-new");
  setBusy(button, true, "新建中");
  try {
    const result = await requestJson("/api/chat/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    activeChatRoomId = result.room.id;
    await loadChatRooms();
  } catch (error) {
    addMessage({ author: "聊天室", text: `新建聊天室失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

function selectedChatRoom() {
  return chatRoomRegistry.rooms.find((room) => room.id === activeChatRoomId)
    ?? chatRoomRegistry.rooms[0]
    ?? null;
}

async function renameSelectedChatRoom() {
  const room = selectedChatRoom();
  if (!room) {
    return;
  }
  const nextName = window.prompt("请输入新的聊天室名称", room.name);
  if (nextName === null) {
    return;
  }
  const name = nextName.trim();
  if (!name || name === room.name) {
    return;
  }
  const button = actionButtons.get("chat-room-rename");
  setBusy(button, true, "重命名中");
  try {
    const result = await requestJson(`/api/chat/rooms/${encodeURIComponent(room.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    activeChatRoomId = result.room.id;
    chatRoomRegistry.rooms = chatRoomRegistry.rooms.map((item) => (
      item.id === result.room.id ? { ...item, ...result.room } : item
    ));
    chatRoomRegistry.active_room_id = activeChatRoomId;
    renderChatRoomList(chatRoomRegistry.rooms, activeChatRoomId);
    updateChatRoomTrigger(result.room.name);
    setText("chat.current", result.room.name);
  } catch (error) {
    addMessage({ author: "聊天室", text: `重命名聊天室失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function deleteSelectedChatRoom() {
  const room = selectedChatRoom();
  if (!room) {
    return;
  }
  const button = actionButtons.get("chat-room-delete");
  setBusy(button, true, "检查中");
  try {
    const impact = await requestJson(`/api/chat/rooms/${encodeURIComponent(room.id)}/impact`);
    const affectedAttachments = impact.affected_attachments ?? 0;
    const ok = window.confirm(
      `确认删除聊天室「${impact.room_name}」？\n\n将删除 ${impact.affected_messages} 条消息、${impact.affected_beads} 条衍生记忆，并清理 ${affectedAttachments} 个无引用附件。`
    );
    if (!ok) {
      return;
    }
    setBusy(button, true, "删除中");
    const result = await requestJson(`/api/chat/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" });
    chatRoomRegistry = result.rooms ?? { rooms: [], active_room_id: null, max_rooms: 8 };
    activeChatRoomId = chatRoomRegistry.active_room_id ?? chatRoomRegistry.rooms[0]?.id ?? null;
    renderChatRoomList(chatRoomRegistry.rooms, activeChatRoomId);
    const active = selectedChatRoom();
    if (active) {
      updateChatRoomTrigger(active.name);
      await loadChatRoomMessages(active.id);
      restoreComposerDraft(active.id);
    } else {
      updateChatRoomTrigger("暂无聊天室");
      clearChatMessagesUi("暂无聊天室");
    }
  } catch (error) {
    addMessage({ author: "聊天室", text: `删除聊天室失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function deleteSelectedMessages() {
  if (!activeChatRoomId || selectedMessageIds.size === 0) {
    return;
  }
  const ids = Array.from(selectedMessageIds);
  const ok = window.confirm(`确认删除当前聊天室中选中的 ${ids.length} 条消息？\n\n由这些消息自动沉淀的记忆也会一并删除。`);
  if (!ok) {
    return;
  }
  const button = actionButtons.get("message-delete-selected");
  setBusy(button, true, "删除中");
  try {
    for (const messageId of ids) {
      await requestJson(
        `/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/messages/${encodeURIComponent(messageId)}`,
        { method: "DELETE" },
      );
    }
    selectedMessageIds.clear();
    updateReferenceSelection();
    await loadChatRoomMessages(activeChatRoomId);
    await refreshActiveBeads();
  } catch (error) {
    addMessage({ author: "聊天室", text: `删除消息失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

function renderSessionList(sessions, activeId) {
  const list = document.querySelector('[data-role="session-list"]');
  if (!list) {
    return;
  }
  list.replaceChildren();
  sessions.forEach((session) => {
    const option = document.createElement("div");
    option.className = "session-option";
    option.dataset.sessionId = session.id;
    option.textContent = session.display_name;
    option.setAttribute("role", "option");
    option.tabIndex = 0;
    option.setAttribute("aria-selected", String(session.id === activeId));
    option.classList.toggle("is-active", session.id === activeId);
    list.append(option);
  });
}

function selectedSessionId() {
  const active = document.querySelector('[data-role="session-list"] .session-option.is-active');
  return activeSessionId || active?.dataset.sessionId;
}

const PROVIDER_MODELS = {
  "DeepSeek": ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
  "智谱 AI (Z.AI)": ["glm-4.7", "glm-4.7-flash", "glm-4.6v-flash", "glm-free", "glm-5"],
  "智谱 AI": ["glm-4.6", "glm-4.7", "glm-4.7-flash", "glm-free"],
  "Moonshot AI": ["kimi-k2-instruct", "kimi-k2"],
  "OpenAI": ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
  "Anthropic": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251213"],
  "xAI (Grok)": ["grok-3", "grok-3-mini"],
  "阿里百炼": ["qwen3.7-max", "qwen-plus", "qwen-turbo", "qwen-max", "glm-5.2", "glm-5.1", "glm-5"],
  "火山方舟": ["doubao-1-5-pro-32k-250115", "doubao-1-5-lite-32k-250115"],
  "百度千帆": ["ernie-4.5-turbo-128k", "ernie-x1-turbo-32k"],
  "Ollama (本地)": [],
  "Custom": ["custom-model"],
};

const CUSTOM_PROVIDER_MODEL_FALLBACK = "custom-model";

const MODEL_TYPE_MAP = {};
(() => {
  const allModels = new Set();
  Object.values(PROVIDER_MODELS).forEach((models) => models.forEach((m) => allModels.add(m)));
  const VISION_ONLY = new Set(["glm-4.6v-flash"]);
  const MULTIMODAL = new Set(["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini", "claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251213", "glm-4.7", "glm-4.7-flash", "glm-5", "glm-5.1", "grok-3", "grok-3-mini", "qwen-plus", "qwen-max", "qwen3.7-max"]);
  allModels.forEach((model) => {
    const lower = model.toLowerCase();
    if (lower.includes("video")) MODEL_TYPE_MAP[model] = "video";
    else if (lower.includes("audio") || lower.includes("whisper") || lower.includes("speech")) MODEL_TYPE_MAP[model] = "audio";
    else if (lower.includes("embedding") || lower.includes("embed")) MODEL_TYPE_MAP[model] = "embedding";
    else if (VISION_ONLY.has(model)) MODEL_TYPE_MAP[model] = "vision";
    else if (MULTIMODAL.has(model)) MODEL_TYPE_MAP[model] = "multimodal";
    else MODEL_TYPE_MAP[model] = "text";
  });
  MODEL_TYPE_MAP["local-tool-runtime"] = "text";
})();

const REASONING_EFFORT_MATRIX = {
  "deepseek-v4-pro": ["low", "medium", "high", "xhigh", "max"],
  "deepseek-v4-flash": ["low", "medium"], "deepseek-chat": ["low", "medium"], "deepseek-reasoner": ["medium", "high"],
  "glm-5": ["low", "medium", "high"], "glm-5.1": ["low", "medium", "high"], "glm-4.7": ["low", "medium", "high"], "glm-4.7-flash": ["low", "medium"],
  "glm-4.6v-flash": ["low", "medium"], "glm-4.6": ["low", "medium"], "glm-free": ["medium"],
  "kimi-k2-instruct": ["low", "medium", "high"], "kimi-k2": ["low", "medium"],
  "gpt-4.1": ["low", "medium", "high", "xhigh"], "gpt-4.1-mini": ["low", "medium", "high"], "gpt-4o-mini": ["low", "medium", "high"],
  "claude-sonnet-4-6": ["low", "medium", "high"], "claude-opus-4-6": ["low", "medium", "high"], "claude-haiku-4-5-20251213": ["low", "medium"],
  "grok-3": ["low", "medium", "high"], "grok-3-mini": ["low", "medium"],
  "qwen-plus": ["low", "medium", "high"], "qwen-turbo": ["low", "medium"], "qwen-max": ["low", "medium", "high"],
  "qwen3.7-max": ["low", "medium", "high"], "glm-5.2": ["low", "medium", "high"],
  "doubao-1-5-pro-32k-250115": ["low", "medium"], "doubao-1-5-lite-32k-250115": ["low", "medium"],
  "ernie-4.5-turbo-128k": ["low", "medium"], "ernie-x1-turbo-32k": ["medium"],
  "default": ["medium"],
};

function isCustomProvider(provider) {
  return (provider || "").trim().toLowerCase() === "custom";
}

function sessionProviderValue() {
  return document.querySelector('[data-role="session-provider"]')?.value ?? "DeepSeek";
}

function sessionModelValueFromForm() {
  const provider = sessionProviderValue();
  if (isCustomProvider(provider)) {
    const customModel = document.querySelector('[data-role="session-custom-model"]')?.value?.trim();
    return customModel || CUSTOM_PROVIDER_MODEL_FALLBACK;
  }
  return document.querySelector('[data-role="session-model"]')?.value?.trim() || CUSTOM_PROVIDER_MODEL_FALLBACK;
}

function updateCustomProviderFields() {
  const provider = sessionProviderValue();
  const custom = isCustomProvider(provider);
  document.querySelectorAll(".custom-provider-field").forEach((field) => {
    field.hidden = !custom;
  });
  const modelSelectField = document.querySelector('[data-role="session-model-select-field"]');
  if (modelSelectField) modelSelectField.hidden = custom;
  const customModel = document.querySelector('[data-role="session-custom-model"]');
  const modelSelect = document.querySelector('[data-role="session-model"]');
  if (custom && customModel && !customModel.value.trim()) {
    const selected = modelSelect?.value?.trim();
    if (selected && selected !== CUSTOM_PROVIDER_MODEL_FALLBACK) customModel.value = selected;
  }
}

function updateModelOptions(preferredModel) {
  const provider = document.querySelector('[data-role="session-provider"]')?.value;
  const modelSelect = document.querySelector('[data-role="session-model"]');
  if (!modelSelect || !provider) return;
  const current = preferredModel || sessionModelValueFromForm();
  const models = isCustomProvider(provider)
    ? [current || CUSTOM_PROVIDER_MODEL_FALLBACK]
    : (PROVIDER_MODELS[provider] || [current].filter(Boolean));
  modelSelect.replaceChildren();
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model; option.textContent = model;
    modelSelect.append(option);
  });
  if (models.includes(current)) modelSelect.value = current;
  else if (models.length > 0) modelSelect.value = models[0];
  if (models.length === 0 && current) {
    const option = document.createElement("option");
    option.value = current; option.textContent = current; option.selected = true;
    modelSelect.append(option);
  }
  if (isCustomProvider(provider)) {
    const customModel = document.querySelector('[data-role="session-custom-model"]');
    if (customModel && current && current !== CUSTOM_PROVIDER_MODEL_FALLBACK) customModel.value = current;
  }
  updateCustomProviderFields();
  renderModelTypeSelect();
  updateReasoningEffortOptions();
}

function renderModelTypeSelect() {
  const model = sessionModelValueFromForm();
  const select = document.querySelector('[data-role="session-model-type"]');
  if (!select) return;
  const lower = (model || "").toLowerCase();
  let type = MODEL_TYPE_MAP[model] || "text";
  // 按 model 名补充识别图片/视频生成模型（如 agnes-image-2.1-flash / agnes-video-v2.0）。
  if (type === "text") {
    if (/image|dall-?e|flux|imagen/.test(lower)) type = "image";
    else if (/video/.test(lower)) type = "video";
  }
  const current = select.value || (type === "vision" ? "vision" : type);
  // 任意文本/多模态模型均可标为「视觉理解(multimodal)」——标记后出现在总览视觉理解候选中，
  // 便于随时把 agnes / glm 等云端会话设为视觉理解模型（不固化具体模型）。
  const options = type === "multimodal" ? [{ v: "multimodal", l: "视觉理解" }, { v: "vision", l: "视觉" }, { v: "text", l: "文本推理" }]
    : type === "vision" ? [{ v: "vision", l: "视觉" }, { v: "multimodal", l: "视觉理解" }]
    : type === "audio" ? [{ v: "audio", l: "音频" }]
    : type === "image" ? [{ v: "image", l: "图片生成" }, { v: "text", l: "文本推理" }]
    : type === "video" ? [{ v: "video", l: "视频生成" }, { v: "text", l: "文本推理" }]
    : [{ v: "text", l: "文本推理" }, { v: "multimodal", l: "视觉理解" }];
  select.replaceChildren();
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.v; option.textContent = opt.l;
    option.selected = opt.v === current;
    select.append(option);
  });
}

function updateReasoningEffortOptions() {
  const model = sessionModelValueFromForm();
  const select = document.querySelector('[data-role="session-reasoning-effort"]');
  if (!select) return;
  const levels = REASONING_EFFORT_MATRIX[model] || REASONING_EFFORT_MATRIX["default"];
  const current = select.value || "medium";
  const labels = { low: "低", medium: "中", high: "高", xhigh: "超高", max: "最大" };
  select.replaceChildren();
  levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level; option.textContent = labels[level] || level;
    option.selected = level === (levels.includes(current) ? current : "medium");
    select.append(option);
  });
}

function sessionPayloadFromForm() {
  const apiInput = document.querySelector('[data-role="session-api-secret"]');
  const apiSecret = apiInput?.value?.trim() ?? "";
  const provider = sessionProviderValue();
  const customProvider = isCustomProvider(provider);
  const payload = {
    name: document.querySelector('[data-role="session-name"]')?.value ?? "",
    provider,
    model: sessionModelValueFromForm(),
    model_type: document.querySelector('[data-role="session-model-type"]')?.value ?? "text",
    avatar: currentAvatarPathFromForm(),
    reasoning_effort: document.querySelector('[data-role="session-reasoning-effort"]')?.value ?? "medium",
  };
  payload.base_url = customProvider
    ? (document.querySelector('[data-role="session-base-url"]')?.value?.trim() ?? "")
    : "";
  payload.endpoint = customProvider
    ? (document.querySelector('[data-role="session-endpoint"]')?.value?.trim() ?? "")
    : "";
  if (apiInput?.dataset.saved !== "1" || apiSecret) payload.api_key_ref = apiSecret;
  return payload;
}

function setSessionForm(session) {
  const name = document.querySelector('[data-role="session-name"]');
  const provider = document.querySelector('[data-role="session-provider"]');
  const model = document.querySelector('[data-role="session-model"]');
  const customModel = document.querySelector('[data-role="session-custom-model"]');
  const baseUrl = document.querySelector('[data-role="session-base-url"]');
  const endpoint = document.querySelector('[data-role="session-endpoint"]');
  const reasoningEffort = document.querySelector('[data-role="session-reasoning-effort"]');
  const apiSecret = document.querySelector('[data-role="session-api-secret"]');
  if (!session) {
    if (name) name.value = "";
    if (provider) provider.value = "DeepSeek";
    updateModelOptions();
    if (model) model.value = model.options[0]?.value ?? "";
    const modelType = document.querySelector('[data-role="session-model-type"]');
    if (modelType) modelType.value = "text";
    if (reasoningEffort) reasoningEffort.value = "medium";
    if (apiSecret) {
      apiSecret.value = "";
      apiSecret.placeholder = "sk-...";
      apiSecret.dataset.saved = "0";
    }
    if (customModel) customModel.value = "";
    if (baseUrl) baseUrl.value = "";
    if (endpoint) endpoint.value = "";
    setSessionAvatarForm("");
    updateCustomProviderFields();
    setGoalRoleForm(null);
    updateSessionTrigger("暂无会话");
    return;
  }
  if (name) name.value = session.name;
  if (provider) provider.value = session.provider;
  if (model) model.value = session.model;
  if (customModel) customModel.value = isCustomProvider(session.provider) ? session.model : "";
  if (baseUrl) baseUrl.value = session.base_url || "";
  if (endpoint) endpoint.value = session.endpoint || "";
  setSessionAvatarForm(session.avatar || "");
  updateModelOptions(session.model);
  if (session.model_type) {
    const mt = document.querySelector('[data-role="session-model-type"]');
    if (mt) mt.value = session.model_type;
  }
  if (reasoningEffort) reasoningEffort.value = session.reasoning_effort || "medium";
  if (apiSecret) {
    if (session.api_key_status && !session.api_key_status.includes("待配置")) {
      apiSecret.value = ""; apiSecret.placeholder = "已配置"; apiSecret.dataset.saved = "1";
    } else {
      apiSecret.value = ""; apiSecret.placeholder = "sk-..."; apiSecret.dataset.saved = "0";
    }
  }
  updateSessionTrigger(session.display_name);
  setGoalRoleForm(session.id);
  loadSessionModelLimit(session.id);
}

// custom provider 手填容量：回显当前生效/默认值（留空=沿用默认表）。
function loadSessionModelLimit(sessionId) {
  const ctxEl = document.querySelector('[data-role="session-context-window"]');
  const outEl = document.querySelector('[data-role="session-max-output"]');
  if (!ctxEl || !outEl || !sessionId) {
    return;
  }
  ctxEl.value = "";
  outEl.value = "";
  requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/model-limit`)
    .then((d) => {
      if (d.overridden) {
        if (d.context_window) ctxEl.value = d.context_window;
        if (d.max_output_tokens) outEl.value = d.max_output_tokens;
      }
      ctxEl.placeholder = `默认 ${d.default_context_window}（留空沿用）`;
      outEl.placeholder = `默认 ${d.default_max_output_tokens}（留空沿用）`;
    })
    .catch((error) => {
      ctxEl.placeholder = "模型容量加载失败";
      outEl.placeholder = "模型容量加载失败";
      ctxEl.title = error?.message || "模型容量加载失败";
      outEl.title = error?.message || "模型容量加载失败";
    });
}

async function persistSessionModelLimit(sessionId) {
  const ctx = Number.parseInt(document.querySelector('[data-role="session-context-window"]')?.value, 10) || 0;
  const out = Number.parseInt(document.querySelector('[data-role="session-max-output"]')?.value, 10) || 0;
  return requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/model-limit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_window: ctx, max_output_tokens: out }),
  });
}

async function loadGoalRoles() {
  try {
    goalRoleRegistry = await requestJson("/api/goals/roles");
    setGoalRoleForm(activeSessionId);
    taskRenderGoalRoleRisks(goalRoleRegistry.roles || []);
    renderOverviewActiveRoles(goalRoleRegistry.roles || []);
    renderGoalRoleAssignmentMatrix();
  } catch (error) {
    goalRoleRegistry = { roles: [], commander_session_id: null, generated_at: null };
    setGoalRoleStatus(`Goal role config load failed: ${error.message}`);
    taskRenderGoalRoleRisks([], error);
    renderOverviewActiveRoles([]);
    renderGoalRoleAssignmentMatrix();
  }
}

function goalRoleForSession(sessionId) {
  return (goalRoleRegistry.roles || []).find((role) => role.session_id === sessionId) || null;
}

function setGoalRoleForm(sessionId) {
  const role = document.querySelector('[data-role="session-goal-role"]');
  const responsibility = document.querySelector('[data-role="session-goal-responsibility"]');
  const commander = document.querySelector('[data-role="session-goal-commander"]');
  const heartbeat = document.querySelector('[data-role="session-goal-heartbeat-timeout"]');
  const taskTimeout = document.querySelector('[data-role="session-goal-task-timeout"]');
  const config = goalRoleForSession(sessionId);
  if (role) role.value = config?.role || "";
  if (responsibility) responsibility.value = config?.responsibility || "";
  if (commander) commander.value = config?.commander ? "true" : "false";
  if (heartbeat) heartbeat.value = String(config?.heartbeat_timeout_ms || 60000);
  if (taskTimeout) taskTimeout.value = String(config?.task_timeout_ms || 600000);
  if (!sessionId) {
    setGoalRoleStatus("No active session for Goal role config.");
    return;
  }
  if (!config) {
    setGoalRoleStatus("Goal role unassigned. Save session to persist a role.");
    return;
  }
  const flags = [
    config.commander ? "commander" : "role",
    config.online ? "online" : "offline",
    config.stuck ? "stuck" : config.risk_level || "normal",
  ];
  setGoalRoleStatus(`${config.display_name}: ${flags.join(" / ")}`);
}

function setGoalRoleStatus(text) {
  const status = document.querySelector('[data-role="goal-role-status"]');
  if (status) status.textContent = text || "";
}

const GOAL_CONSULT_ROLES = ["commander", "planner", "implementer", "verifier"];

function goalConsultCandidateSessions() {
  const sessions = Array.isArray(sessionRegistry.sessions) ? sessionRegistry.sessions : [];
  return sessions.filter(goalConsultEligibleSession);
}

function goalConsultEligibleSession(session) {
  if (!session?.id) {
    return false;
  }
  const activeVisionId = activeOverviewVisionAgent?.id || activeOverviewVisionAgent || "";
  const modelType = String(session.model_type || MODEL_TYPE_MAP[session.model] || "text").toLowerCase();
  return session.id !== activeVisionId && !["vision", "multimodal", "video"].includes(modelType);
}

function goalRoleConfigRoles(value) {
  return String(value || "")
    .split(/[;,|]/)
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function goalRoleConfigHasRole(value, roleName) {
  const normalized = String(roleName || "").trim().toLowerCase();
  return Boolean(normalized) && goalRoleConfigRoles(value).includes(normalized);
}

function goalRolesReady(registry = goalRoleRegistry) {
  const roles = Array.isArray(registry?.roles) ? registry.roles : [];
  const hasCommander = Boolean(
    registry?.commander_session_id ||
      roles.some((role) => role?.commander || goalRoleConfigHasRole(role?.role, "commander"))
  );
  return (
    hasCommander &&
    ["planner", "implementer", "verifier"].every((roleName) =>
      roles.some((role) => role && goalRoleConfigHasRole(role.role, roleName))
    )
  );
}

function goalRoleAssignedSessionId(roleName) {
  const normalized = String(roleName || "").toLowerCase();
  const roles = goalRoleRegistry.roles || [];
  if (normalized === "commander" && goalRoleRegistry.commander_session_id) {
    return goalRoleRegistry.commander_session_id;
  }
  return roles.find((role) => role && goalRoleConfigHasRole(role.role, normalized))?.session_id || "";
}

function renderGoalRoleAssignmentMatrix() {
  const selects = document.querySelectorAll("[data-goal-role-assignment]");
  if (!selects.length) return;
  const sessions = goalConsultCandidateSessions();
  selects.forEach((select) => {
    const role = select.dataset.goalRoleAssignment;
    let selected = goalRoleAssignedSessionId(role);
    if (!selected && role === "commander" && activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
      selected = activeSessionId;
    }
    select.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "选择会话配置";
    select.append(empty);
    sessions.forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = session.display_name || `${session.name || session.id} (${session.model || "-"})`;
      select.append(option);
    });
    select.value = sessions.some((session) => session.id === selected) ? selected : "";
  });
}

function goalRoleResponsibility(roleName) {
  switch (roleName) {
    case "commander":
      return "Coordinate role allocation, dispatch checkpoints, progress monitoring, and cleanup.";
    case "planner":
      return "Break goals into ordered phases, dependencies, completion conditions, and acceptance evidence.";
    case "implementer":
      return "Execute assigned implementation phases with scoped edits and verification notes.";
    case "verifier":
      return "Check completion evidence, tests, regressions, and final acceptance criteria.";
    default:
      return "Execute the assigned goal role and report concise evidence.";
  }
}

function collectGoalRoleAssignments() {
  return Array.from(document.querySelectorAll("[data-goal-role-assignment]"))
    .map((select) => ({
      role: select.dataset.goalRoleAssignment,
      session_id: select.value,
      commander: select.dataset.goalRoleAssignment === "commander",
      responsibility: goalRoleResponsibility(select.dataset.goalRoleAssignment),
    }))
    .filter((assignment) => assignment.role && assignment.session_id);
}

async function submitGoalRoleAssignments(assignments) {
  if (!assignments.length) {
    setGoalRoleStatus("Select at least one Goal role session.");
    return null;
  }
  goalRoleRegistry = await requestJson("/api/goals/roles/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
  setGoalRoleForm(activeSessionId);
  taskRenderGoalRoleRisks(goalRoleRegistry.roles || []);
  renderOverviewActiveRoles(goalRoleRegistry.roles || []);
  renderGoalRoleAssignmentMatrix();
  return goalRoleRegistry;
}

async function applyGoalRoleAssignments() {
  const button = actionButtons.get("goal-role-assign");
  const assignments = collectGoalRoleAssignments();
  if (!assignments.length) {
    setGoalRoleStatus("Select at least one Goal role session.");
    return;
  }
  setBusy(button, true, "Assigning");
  try {
    await submitGoalRoleAssignments(assignments);
    setGoalRoleStatus(`Applied ${assignments.length} Goal role assignment(s).`);
  } catch (error) {
    setGoalRoleStatus(`Goal role assignment failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function confirmGoalRolesAndPlan(goal, button) {
  if (!goal?.id) {
    setGoalRoleStatus("Goal id is missing.");
    return;
  }
  const assignments = collectGoalRoleAssignments();
  setBusy(button, true, "Confirming");
  try {
    if (assignments.length) {
      await submitGoalRoleAssignments(assignments);
    } else {
      await loadGoalRoles();
    }
    if (!goalRolesReady()) {
      setGoalRoleStatus("Goal roles are incomplete. Assign required roles first.");
      return;
    }
    const hasPhases = Boolean(goal.phases?.length);
    if (!hasPhases) {
      await requestJson(`/api/goals/${encodeURIComponent(goal.id)}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalSeedPlanPayload(goal)),
      });
    }
    await refreshGoals();
    await loadGoalRoles();
    refreshOpenGoalTaskChain(goal.id);
    setGoalRoleStatus(hasPhases ? "Goal roles confirmed." : "Goal roles confirmed and serial plan seeded.");
  } catch (error) {
    setGoalRoleStatus(`Confirm roles failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

function goalRolePayloadFromForm() {
  const heartbeat = Number(document.querySelector('[data-role="session-goal-heartbeat-timeout"]')?.value || 60000);
  const taskTimeout = Number(document.querySelector('[data-role="session-goal-task-timeout"]')?.value || 600000);
  return {
    role: document.querySelector('[data-role="session-goal-role"]')?.value || "",
    responsibility: document.querySelector('[data-role="session-goal-responsibility"]')?.value || "",
    commander: document.querySelector('[data-role="session-goal-commander"]')?.value === "true",
    heartbeat_timeout_ms: Number.isFinite(heartbeat) ? heartbeat : 60000,
    task_timeout_ms: Number.isFinite(taskTimeout) ? taskTimeout : 600000,
  };
}

async function saveGoalRoleConfig(sessionId) {
  if (!sessionId) return;
  goalRoleRegistry = await requestJson(`/api/goals/roles/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goalRolePayloadFromForm()),
  });
  setGoalRoleForm(sessionId);
  renderOverviewActiveRoles(goalRoleRegistry.roles || []);
}

async function bootstrapGoalRoleSessions() {
  const button = actionButtons.get("goal-role-bootstrap");
  const selectedRole = document.querySelector('[data-role="session-goal-role"]')?.value || "";
  const roles = selectedRole ? [selectedRole] : [];
  setBusy(button, true, "Bootstrap");
  try {
    const result = await requestJson("/api/goals/roles/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });
    goalRoleRegistry = result.roles || { roles: [], commander_session_id: null, generated_at: null };
    await loadSessions();
    setGoalRoleForm(activeSessionId);
    taskRenderGoalRoleRisks(goalRoleRegistry.roles || []);
    renderOverviewActiveRoles(goalRoleRegistry.roles || []);
    const created = Array.isArray(result.created) ? result.created : [];
    setGoalRoleStatus(created.length
      ? `Bootstrapped ${created.length} Goal role session(s).`
      : "Goal role sessions already exist.");
  } catch (error) {
    setGoalRoleStatus(`Bootstrap failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function sendGoalRoleHeartbeat() {
  const sessionId = selectedSessionId();
  if (!sessionId) return;
  const button = actionButtons.get("goal-role-heartbeat");
  setBusy(button, true, "Heartbeat");
  try {
    goalRoleRegistry = await requestJson(`/api/goals/roles/${encodeURIComponent(sessionId)}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_active: false }),
    });
    setGoalRoleForm(sessionId);
    renderOverviewActiveRoles(goalRoleRegistry.roles || []);
  } catch (error) {
    setGoalRoleStatus(`Heartbeat failed: ${error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function createSession() {
  const button = actionButtons.get("session-new");
  setBusy(button, true, "新建中");
  try {
    const payload = sessionPayloadFromForm();
    payload.name = payload.name ? `${payload.name}-副本` : "";
    const result = await requestJson("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    activeSessionId = result.session.id;
    updateSessionTrigger(result.session.display_name);
    await loadSessions();
    await loadAgents();
    // 反馈：选中并载入新会话到表单 + 提示，避免“点了没反应”的错觉（修复新建会话不生效）。
    renderSessionList(sessionRegistry.sessions, activeSessionId);
    setSessionForm(result.session);
    addMessage({
      author: "会话管理",
      text: `已新建会话：${result.session.display_name}`,
      kind: "thought",
      icon: "session-new",
    });
  } catch (error) {
    addMessage({ author: "会话管理", text: `新建失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function openSelectedSession() {
  const sessionId = selectedSessionId();
  if (!sessionId) {
    return;
  }
  const result = await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/activate`, { method: "POST" });
  activeSessionId = result.session.id;
  renderSessionList(sessionRegistry.sessions, activeSessionId);
  setSessionForm(result.session);
  await loadSessionBeads(activeSessionId);
  await loadAgents();
  syncActiveSessionSummary(result.session);
}

async function saveSelectedSession() {
  const sessionId = selectedSessionId();
  if (!sessionId) {
    return;
  }
  const button = actionButtons.get("session-save");
  setBusy(button, true, "保存中");
  setWorkbenchMotionState("settings", WORKBENCH_MOTION_STATES.settings, true);
  try {
    await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionPayloadFromForm()),
    });
    await persistSessionModelLimit(sessionId);
    await saveGoalRoleConfig(sessionId);
    await loadSessions();
    await loadAgents();
    await loadGoalRoles();
  } catch (error) {
    addMessage({ author: "会话管理", text: `保存失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setWorkbenchMotionState("settings", WORKBENCH_MOTION_STATES.settings, false);
    setBusy(button, false);
  }
}

async function deleteSelectedSession() {
  const sessionId = selectedSessionId();
  if (!sessionId) {
    return;
  }
  const button = actionButtons.get("session-delete");
  setBusy(button, true, "删除中");
  try {
    await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    document.querySelectorAll(`.message[data-session-id="${CSS.escape(sessionId)}"]`).forEach((node) => node.remove());
    await loadSessions();
    await loadGoalRoles();
    await memoryWindowRefresh();
  } catch (error) {
    addMessage({ author: "会话管理", text: `删除失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function resetSelectedSession() {
  const sessionId = selectedSessionId();
  if (!sessionId) {
    return;
  }
  const session = sessionRegistry.sessions?.find((candidate) => candidate.id === sessionId);
  const label = session?.display_name || session?.name || sessionId;
  if (!window.confirm(`重置会话 ${label}？当前会话消息与显式 memory 会被清空，并开启新的远端上下文加载边界。`)) {
    return;
  }
  const button = actionButtons.get("session-reset");
  setBusy(button, true, "重置中");
  try {
    const result = await requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/reset`, { method: "POST" });
    document.querySelectorAll(`.message[data-session-id="${CSS.escape(sessionId)}"]`).forEach((node) => node.remove());
    await loadSessions();
    await loadGoalRoles();
    await memoryWindowRefresh();
    syncActiveSessionSummary(result.session);
    addMessage({
      author: "会话管理",
      text: `${label} 已重置，后续请求会按新的会话上下文边界加载。`,
      kind: "tool-summary",
      icon: "refresh",
    });
  } catch (error) {
    addMessage({ author: "会话管理", text: `重置失败：${error.message}`, kind: "thought", icon: "error-log" });
  } finally {
    setBusy(button, false);
  }
}

async function loadToolsCatalog() {
  const host = document.querySelector('[data-role="tool-catalog"]');
  if (!host) {
    return;
  }
  try {
    toolCatalog = await requestJson("/api/tools/catalog");
    renderToolsCatalog(toolCatalog);
    renderToolInventoryCatalogStatus(toolCatalog);
    renderToolScenarioMatrix(toolCatalog);
    renderToolStatusStrip(toolCatalog);
    renderLocalModelsSwitch();
  } catch (error) {
    host.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "tool-catalog-empty";
    empty.textContent = `工具目录加载失败：${error.message}`;
    host.append(empty);
  }
}

// 「计划配置」入口：切换到任务窗口并展开模块自检列的「调度诊断」折叠卡。
function openDispatchDiagnostics() {
  document.querySelector('[data-window-target="tasks"]')?.click();
  const card = document.querySelector('[data-role="dispatch-diagnostic"]');
  if (card) {
    card.open = true;
    window.requestAnimationFrame(() => {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
}

function onToolInventoryManage(event) {
  const button = event.currentTarget;
  const controls = document.querySelector('[data-role="tool-legacy-controls"]');
  if (!button || !controls) {
    return;
  }
  const requestedTarget = button.dataset.toolTarget || "catalog";
  const detailTarget = requestedTarget.startsWith("catalog-") ? "catalog" : requestedTarget;
  const shouldClose =
    requestedTarget === "close"
    || (!controls.hidden && controls.dataset.activeTarget === requestedTarget);

  document.querySelectorAll('[data-action="tool-inventory-manage"]').forEach((node) => {
    node.setAttribute("aria-expanded", "false");
  });
  if (shouldClose) {
    controls.hidden = true;
    controls.dataset.activeTarget = "";
    return;
  }

  controls.hidden = false;
  controls.dataset.activeTarget = requestedTarget;
  button.setAttribute("aria-expanded", "true");
  controls.querySelectorAll("[data-tool-detail]").forEach((section) => {
    section.hidden = section.dataset.toolDetail !== detailTarget;
  });

  const titles = {
    "local-model": "本地模型服务管理",
    "catalog-cli": "CLI 工具管理",
    "catalog-mcp": "MCP 工具管理",
    "catalog-skill": "Skill / 插件管理",
    "catalog-compute-use": "compute-use 管理",
    "semantic-dispatch": "语义调度计划配置",
  };
  const title = controls.querySelector('[data-role="tool-legacy-title"]');
  if (title) {
    title.textContent = titles[requestedTarget] || "工具管理详情";
  }

  if (requestedTarget === "catalog-compute-use") {
    toolCatalogSearch = "compute-use";
    renderToolsCatalog(toolCatalog);
  } else if (detailTarget === "catalog" && toolCatalogSearch) {
    toolCatalogSearch = "";
    renderToolsCatalog(toolCatalog);
  }

  window.requestAnimationFrame(() => {
    const activeSection = controls.querySelector(`[data-tool-detail="${detailTarget}"]`);
    activeSection?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    activeSection?.querySelector("input, select, button")?.focus({ preventScroll: true });
  });
}

function renderToolInventoryCatalogStatus(catalog) {
  TOOL_GROUP_DEFS.forEach((def) => {
    const count = toolGroupItems(catalog, def, "").length;
    const status = document.querySelector(`[data-role="tool-inventory-status-${def.key}"]`);
    if (!status) {
      return;
    }
    status.textContent = count > 0 ? `可用 ${count}/${count}` : "未启用";
    status.classList.toggle("is-online", count > 0);
    status.classList.toggle("is-offline", count === 0);
  });

  const items = flattenToolCatalog(catalog);
  const computeRow = document.querySelector('[data-tool-inventory="compute-use"]');
  if (!computeRow) {
    return;
  }
  const available = items.some((item) => {
    const identity = `${item?.id || ""} ${item?.name || ""} ${item?.display_name || ""}`.toLowerCase();
    return identity.includes("compute-use") || identity.includes("computer-use");
  });
  const status = computeRow.querySelector(".tool-inventory-status");
  const button = computeRow.querySelector('[data-action="tool-inventory-manage"]');
  if (status) {
    status.textContent = available ? "可用" : "未启用";
    status.classList.toggle("is-online", available);
    status.classList.toggle("is-offline", !available);
  }
  if (button) {
    button.textContent = available ? "管理" : "启用";
  }
}

async function captureDesktop() {
  const button = actionButtons.get("capture");
  setBusy(button, true, "采集中");
  try {
    const capture = await requestJson("/api/capture", { method: "POST" });
    setVisionPreview(capture);
    addMessage({
      author: "系统视觉 Agent",
      text: `已保存最新桌面截图：${capture.path}`,
      kind: "bot",
      icon: "inner-vision",
    });
  } catch (error) {
    addMessage({
      author: "系统视觉 Agent",
      text: `截图失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

async function runStability() {
  const button = actionButtons.get("stability-run");
  setBusy(button, true, "测试中");
  try {
    const result = await requestJson("/api/stability/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: true }),
    });
    setText("stability.mode", `${result.status} / ${result.total_checks} 项`);
    const first = result.matrix.scenarios[0];
    const point = first?.points?.find((item) => item.resolution === "fhd-100") ?? first?.points?.[0];
    const summary = point
      ? `${first.target} ${first.action} -> ${point.resolution} 坐标 (${point.x}, ${point.y})`
      : "稳定性矩阵已生成。";
    addMessage({
      author: "系统工具执行 Agent",
      text: `${summary}。当前为 dry-run，不执行真实点击。`,
      kind: "bot",
      icon: "result",
    });
  } catch (error) {
    addMessage({
      author: "稳定性测试",
      text: `测试失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

async function runClosedLoop() {
  const button = actionButtons.get("closed-loop");
  setBusy(button, true, "闭环中");
  try {
    const result = await requestJson("/api/computer-use/closed-loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: "desktop-icon-left-click",
        execute: false,
        confirm_after: true,
        roi_radius: 64,
      }),
    });
    const summary = `${result.target} ${result.action} -> (${result.point.x}, ${result.point.y})，ROI ${result.roi.width}x${result.roi.height}`;
    addMessage({
      author: "视觉键鼠闭环",
      text: `${summary}。当前为 dry-run，前后截图已完成。`,
      kind: "bot",
      icon: "monitor-on",
    });
  } catch (error) {
    addMessage({
      author: "视觉键鼠闭环",
      text: `闭环失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

async function runSafeClickTest() {
  const button = actionButtons.get("safe-click-test");
  setBusy(button, true, "点击中");
  try {
    const result = await requestJson("/api/computer-use/safe-click-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startup_delay_ms: 900,
        marker_timeout_ms: 3500,
        layout: "random",
        use_visual_grounding: false,
      }),
    });
    const clickPoint = result.vision?.point ?? result.window.click_point;
    const source = result.vision?.source ?? "geometry-fallback";
    const summary = result.marker.hit
      ? `真实鼠标点击命中测试窗口，目标数字 ${result.target_number}，${source} 点击点 (${clickPoint.x}, ${clickPoint.y})。`
      : `真实鼠标点击未命中，目标数字 ${result.target_number}，${source} 点击点 (${clickPoint.x}, ${clickPoint.y})。`;
    addMessage({
      author: "真实输入测试",
      text: summary,
      kind: result.marker.hit ? "bot" : "thought",
      icon: result.marker.hit ? "success" : "fail",
    });
  } catch (error) {
    addMessage({
      author: "真实输入测试",
      text: `执行失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

async function runComputerUseProfile() {
  const button = actionButtons.get("profile-run");
  setBusy(button, true, "分析中");
  try {
    const result = await requestJson("/api/computer-use/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: "desktop-icon-left-click",
        execute: false,
        confirm_after: true,
        roi_radius: 64,
        after_delay_ms: 120,
      }),
    });
    renderProfile(result);
    addMessage({
      author: "性能分析",
      text: `视觉键鼠链路总耗时 ${result.total_elapsed_ms}ms，主要阶段见测试实验室。`,
      kind: "bot",
      icon: "loading",
    });
  } catch (error) {
    addMessage({
      author: "性能分析",
      text: `耗时分析失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

let lastUserIntent = "";

async function sendMessage({ replaceActive = false } = {}) {
  if (activeChatAbortController) {
    activeChatAbortController.abort();
    if (!replaceActive) {
      return;
    }
    activeChatAbortController = null;
  }
  const t0 = performance.now();
  const input = document.querySelector('[data-role="message-input"]');
  const text = input?.value.trim() ?? "";
  if (!text && selectedMessageIds.size === 0 && pendingFileAttachments.length === 0) {
    input?.focus();
    return;
  }

  lastUserIntent = text;

  const button = actionButtons.get("send-message");
  const abortController = new AbortController();
  activeChatAbortController = abortController;
  setSendButtonRunning(true);
  triggerComposerSignalWave();
  let payload = null;
  try {
    const pendingAttachments = await uploadComposerAttachments();
    payload = {
      session_id: activeSessionId,
      chat_room_id: activeChatRoomId,
      target_agent_ids: getSelectedAgentIds(),
      text,
      selected_message_ids: Array.from(selectedMessageIds),
      attachments: [...attachmentsFromText(text), ...pendingAttachments],
    };
    resetComposerSelection(input);
    await streamChat(payload, { t0, signal: abortController.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      addMessage({
        author: "消息分发",
        text: "已停止模型思考和回复。",
        kind: "thought",
        icon: "warn-log",
      });
      return;
    }
    if (!payload) {
      addMessage({
        author: "附件上传",
        text: `上传失败：${error.message}`,
        kind: "thought",
        icon: "error-log",
      });
      return;
    }
    try {
      await sendMessageFallback(payload, text, { t0 });
    } catch (fallbackError) {
      addMessage({
        author: "消息分发",
        text: `发送失败：${fallbackError.message || error.message}`,
        kind: "thought",
        icon: "error-log",
      });
    }
  } finally {
    if (activeChatAbortController === abortController) {
      activeChatAbortController = null;
      setSendButtonRunning(false);
    }
  }
}

function triggerComposerSignalWave() {
  const composer = document.querySelector(".composer");
  if (!composer) return;
  composer.classList.remove("signal-wave");
  void composer.offsetWidth;
  composer.classList.add("signal-wave");
  window.setTimeout(() => composer.classList.remove("signal-wave"), 460);
}

async function streamChat(payload, { t0, signal } = {}) {
  const response = await fetch("/api/chat/send/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    throw new Error(data.error || response.statusText || "流式接口不可用");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let donePayload = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) {
        const result = handleChatStreamEvent(event);
        if (event.event === "done") {
          donePayload = result;
        }
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const event = parseSseFrame(buffer);
    if (event) {
      const result = handleChatStreamEvent(event);
      if (event.event === "done") {
        donePayload = result;
      }
    }
  }
  console.debug(`chat stream ${Math.round(performance.now() - (t0 ?? performance.now()))}ms`);
  if (donePayload?.tasks) {
    renderTaskList(donePayload.tasks);
    await refreshGoals();
    await autoStartReadyGoalLoops();
  }
  await refreshActiveBeads();
  await refreshChatCollaboration(activeChatRoomId);
}

function parseSseFrame(frame) {
  let event = "message";
  const dataLines = [];
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  });
  if (!dataLines.length) {
    return null;
  }
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch (error) {
    console.warn("无法解析 SSE 消息:", error, frame);
    return null;
  }
}

function handleChatStreamEvent({ event, data }) {
  if (event === "message" || event === "message_start" || event === "message_replace") {
    if (isGoalPhaseMessage(data)) {
      refreshOpenGoalTaskChain(data.goal_id || data.goalId);
      return data;
    }
    if (event === "message_start" && realtimeFullStreamOperational()) {
      realtimeTurn.messageId = data.id || realtimeTurn.messageId;
    }
    upsertMessage(data, { streaming: event === "message_start" });
    if (event === "message" && (data.kind === "tool-summary" || data.kind === "tool-call" || data.kind === "computer-use")) {
      showToolExecButtons();
    }
    return data;
  }
  if (event === "message_delta") {
    commitRealtimeAssistantDelta(data);
    appendMessageText(data.id, data.delta);
    return data;
  }
  if (event === "message_done") {
    if (!shouldRenderCompletedMessage(data)) {
      return data;
    }
    hideReasoningForAssistant(data.id);
    upsertMessage(data, { streaming: false });
    flushRealtimeAssistantSpeech(data);
    maybeAutoSpeakRealtimeReply(data);
    return data;
  }
  if (event === "done") {
    return data;
  }
  if (event === "error") {
    addMessage({
      author: "消息分发",
      text: data.message || "流式消息处理失败",
      kind: "thought",
      icon: "error-log",
    });
    return data;
  }
  return data;
}

function shouldRenderCompletedMessage(message) {
  if (!message) {
    return false;
  }
  if (isGoalPhaseMessage(message)) {
    return false;
  }
  const kind = message?.kind ?? kindForMessage(message || {});
  return message.kind !== "reasoning" && message.kind !== "tool-call" && kind !== "reasoning" && kind !== "tool-call";
}

function isSpeakableAssistantReplyForTts(message) {
  if (!message || !shouldRenderCompletedMessage(message) || isGoalPhaseMessage(message)) {
    return false;
  }
  const kind = String(message.kind || "").toLowerCase();
  const blockedKinds = new Set([
    "reasoning",
    "tool-call",
    "tool-summary",
    "computer-use",
    "vision-computer-use",
    "goal-phase",
    "task-summary",
    "scheduled-task",
  ]);
  if (blockedKinds.has(kind)) {
    return false;
  }
  if (kind === "assistant-reply" || kind === "assistant-fallback") {
    return true;
  }
  return message.role === "assistant" || kind === "";
}

async function maybeAutoSpeakRealtimeReply(message) {
  // 门控：实时语音模式 或 语音输入触发的本轮回复，都自动朗读。
  const wantAuto = audioRealtimeAutoTtsEnabled || voiceInputAwaitingTts;
  if (!wantAuto || (!audioRealtimeRunning && !audioRealtimeAwaitingReplyTts && !voiceInputAwaitingTts)) {
    return;
  }
  if (!isSpeakableAssistantReplyForTts(message)) {
    return;
  }
  const messageId = message.id || `${message.author || "assistant"}:${message.created_at || ""}:${message.content || ""}`;
  if (realtimeFullStreamOperational() && realtimeTurn.streamedMessageIds.has(messageId)) {
    audioRealtimeSpokenMessageIds.add(messageId);
    voiceInputAwaitingTts = false;
    audioRealtimeAwaitingReplyTts = false;
    audioRealtimeResumeAfterTts = false;
    audioRealtimeAutoTtsEnabled = realtimeSessionRunning || audioRealtimeRunning;
    return;
  }
  if (audioRealtimeSpokenMessageIds.has(messageId)) {
    return;
  }
  const text = sanitizeAssistantMessageTextForTts(message.content);
  if (!text) {
    return;
  }
  audioRealtimeSpokenMessageIds.add(messageId);
  const wasVoiceInput = voiceInputAwaitingTts;
  voiceInputAwaitingTts = false; // 本轮回复已认领朗读，避免后续消息重复
  try {
    await ttsSpeakText(text, {
      source: wasVoiceInput ? "voice-input-auto" : "realtime-auto",
      voice: selectedTtsVoice,
      segmented: true,
      preferStreaming: realtimeStreamingTtsEnabled(),
    });
  } catch (error) {
    showSttStatus("实时朗读失败: " + error.message);
  } finally {
    if (audioRealtimeAwaitingReplyTts) {
      const shouldResumeListening = audioRealtimeResumeAfterTts && realtimeSessionRunning;
      audioRealtimeAwaitingReplyTts = false;
      audioRealtimeResumeAfterTts = false;
      audioRealtimeAutoTtsEnabled = audioRealtimeRunning || shouldResumeListening;
      if (shouldResumeListening) {
        await refreshRealtimeSessionStatus();
        if (realtimeSessionRunning) {
          await audioRealtimeStart({ backendStarted: true, status: realtimeSessionStatus });
        }
      }
    }
  }
}

function isGoalPhaseMessage(message) {
  if (!message) {
    return false;
  }
  const id = String(message.id || "");
  const author = String(message.author || "").toLowerCase();
  const target = String(message.target || "").toLowerCase();
  const kind = String(message.kind || "").toLowerCase();
  return Boolean(message.goalId || message.goal_id || message.goalTransient)
    || id.startsWith("msg-goal-")
    || id.startsWith("goal-event-")
    || kind === "goal-phase"
    || author.includes("goal phase")
    || target.includes("goal phase");
}

function hideReasoningForAssistant(assistantId) {
  const list = chatMessageList();
  if (!list || !assistantId) {
    return;
  }
  const reasoningId = `${assistantId}-thinking`;
  list.querySelector(`[data-message-id="${CSS.escape(reasoningId)}"]`)?.remove();
}

function showToolExecButtons() {
  const container = document.querySelector('[data-role="tool-exec-actions"]');
  if (container) container.style.display = "";
}

function hideToolExecButtons() {
  const container = document.querySelector('[data-role="tool-exec-actions"]');
  if (container) container.style.display = "none";
}

function dispatchSummary(response) {
  const p = response.dispatch_plan;
  const lines = [
    `语义工具调度：${response.route} / ${response.status}。`,
  ];
  if (p) {
    lines.push(`${p.llm_tool_call?.name || "unknown"}，action=${p.action}，execute_allowed=${p.execute_allowed}。`);
    lines.push(`安全闸门：${p.safety_gate}。`);
    if (p.action_plan) {
      const ap = p.action_plan;
      const pt = ap.path.length === 0 ? "无坐标" : `(${ap.point?.x}, ${ap.point?.y})`;
      lines.push(`动作计划：target=${ap.target}，point=${pt}，steps=${ap.steps}。`);
    }
  }
  if (response.notes?.length) {
    lines.push(...response.notes);
  }
  return lines.join("\n");
}

async function sendMessageFallback(payload, text, { t0 } = {}) {
  const result = await requestJson("/api/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.debug(`chat send ${Math.round(performance.now() - (t0 ?? performance.now()))}ms`);
  result.messages
    .filter(shouldRenderCompletedMessage)
    .forEach((message) => upsertMessage(message, { sessionId: activeSessionId }));
  renderTaskList(result.tasks);
  await refreshGoals();
  await autoStartReadyGoalLoops();
  await persistMemoryBeadFromMessage(text, result.messages);
  await refreshChatCollaboration(activeChatRoomId);
}

function resetComposerSelection(input) {
  if (input) {
    input.value = "";
  }
  clearComposerDraft();
  clearComposerAttachments();
  selectedMessageIds.clear();
  document.querySelectorAll(".message.is-selected").forEach((node) => node.classList.remove("is-selected"));
  updateReferenceSelection();
}

async function refreshActiveBeads() {
  if (!activeSessionId) {
    return;
  }
  await loadSessionBeads(activeSessionId);
}

async function persistMemoryBeadFromMessage(text, messages = []) {
  if (!activeSessionId || !text || text.length < 12) {
    return;
  }
  const thoughtSnippets = messages
    .filter((message) => message.role === "assistant" || message.kind === "task-summary")
    .map((message) => message.content)
    .slice(0, 3);
  const summaryParts = [];
  if (text) summaryParts.push(text.length > 110 ? `${text.slice(0, 110)}...` : text);
  summaryParts.push(...thoughtSnippets);
  const summary = summaryParts.filter(Boolean).join(" / ").slice(0, 240);
  try {
    const result = await requestJson(`/api/sessions/${encodeURIComponent(activeSessionId)}/beads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "chat-room",
        layer: "L2",
        summary,
        source: "chat-room",
        pinned: false,
        confidence: 0.68,
      }),
    });
  } catch (error) {
    console.warn("记忆 bead 写入失败:", error);
  }
}

function renderAgentOptions(agents, activeIds) {
  const container = document.querySelector('[data-role="agent-targets"]');
  if (!container) {
    return;
  }
  container.replaceChildren();
  agents.forEach((agent) => {
    const label = document.createElement("label");
    label.className = "agent-cb";
    const avatarPath = avatarForSession(sessionById(agent.id) || agent);
    if (avatarPath) {
      label.classList.add("has-avatar");
      label.style.setProperty("--agent-theme", avatarThemeForPath(avatarPath));
    }
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = agent.id;
    checkbox.checked = activeIds.includes(agent.id);
    label.append(checkbox);
    if (avatarPath) {
      const img = document.createElement("img");
      img.src = avatarUrl(avatarPath);
      img.alt = "";
      label.append(img);
    }
    label.append(` ${agent.name}`);
    container.append(label);
  });
  updateAgentTriggerText();
}

function chatRecipientStorageKey(roomId = activeChatRoomId) {
  const roomKey = encodeURIComponent(String(roomId || "default"));
  return `${chatRecipientStoragePrefix}${activeWorkspaceKey}.${roomKey}`;
}

function readPersistedAgentTargets(roomId = activeChatRoomId) {
  try {
    const stored = localStorage.getItem(chatRecipientStorageKey(roomId));
    if (stored === null) {
      return null;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch (error) {
    console.warn("发送对象恢复失败:", error);
    return null;
  }
}

function persistAgentTargets(roomId = activeChatRoomId) {
  if (!roomId) {
    return;
  }
  try {
    localStorage.setItem(chatRecipientStorageKey(roomId), JSON.stringify(getSelectedAgentIds()));
  } catch (error) {
    console.warn("发送对象保存失败:", error);
  }
}

function restoreAgentTargets(agents, fallbackIds = [], roomId = activeChatRoomId) {
  const validIds = new Set((Array.isArray(agents) ? agents : []).map((agent) => String(agent.id)));
  const savedIds = readPersistedAgentTargets(roomId);
  const restoredIds = (savedIds || []).filter((id) => validIds.has(id));
  const fallbackTargets = (Array.isArray(fallbackIds) ? fallbackIds : [])
    .map(String)
    .filter((id) => validIds.has(id));
  const selectedIds = restoredIds.length
    ? restoredIds
    : (fallbackTargets.length ? fallbackTargets : Array.from(validIds).slice(0, 1));
  const selected = new Set(selectedIds);
  document.querySelectorAll('[data-role="agent-targets"] input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
  updateAgentTriggerText();
}

function setSingleAgentTarget(agentId) {
  document.querySelectorAll('[data-role="agent-targets"] input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = checkbox.value === agentId;
  });
  updateAgentTriggerText();
  persistAgentTargets(activeChatRoomId);
}

function renderChatRoomList(rooms, activeId) {
  const list = document.querySelector('[data-role="chat-room-list"]');
  if (!list) return;
  list.replaceChildren();
  rooms.forEach((room) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "session-option";
    option.dataset.roomId = room.id;
    option.textContent = room.name;
    option.setAttribute("role", "option");
    option.tabIndex = 0;
    option.setAttribute("aria-selected", String(room.id === activeId));
    option.classList.toggle("is-active", room.id === activeId);
    list.append(option);
  });
}

async function openSelectedChatRoom() {
  if (!activeChatRoomId) {
    return;
  }
  const result = await requestJson(`/api/chat/rooms/${encodeURIComponent(activeChatRoomId)}/activate`, { method: "POST" });
  activeChatRoomId = result.room.id;
  renderChatRoomList(chatRoomRegistry.rooms, activeChatRoomId);
  updateChatRoomTrigger(result.room.name);
  restoreAgentTargets(
    agentRegistry.agents.filter((agent) => agent.selectable),
    agentRegistry.active_agent_ids,
    activeChatRoomId,
  );
  await loadChatRoomMessages(activeChatRoomId);
  await refreshFullAccessStatus();
  restoreComposerDraft(activeChatRoomId);
}

function iconForMessage(message) {
  if (message.kind === "handoff-inbound") {
    return "chat";
  }
  if (message.role === "user") {
    return message.kind === "multimedia" ? "image-preview" : "robot-message";
  }
  if (message.kind === "task-summary") {
    return "task-list";
  }
  if (message.kind === "tool-call" || message.kind === "tool-summary" || message.kind === "computer-use") {
    return "cli";
  }
  if (message.kind === "vision" || message.kind === "vision-computer-use") {
    return "inner-vision";
  }
  if (message.kind === "reasoning") {
    return "thinking";
  }
  if (message.kind === "assistant-fallback") {
    return "info-log";
  }
  if (message.kind === "multimedia") {
    return "image-preview";
  }
  return "robot-message";
}

function kindForMessage(message) {
  if (message.kind === "handoff-inbound") {
    return "thought handoff-inbound";
  }
  if (message.role === "user") {
    return message.kind === "multimedia" ? "user multimedia" : "user";
  }
  if (message.kind === "task-summary" || message.kind === "reasoning") {
    return `thought ${message.kind}`;
  }
  if (message.kind === "tool-call" || message.kind === "tool-summary" || message.kind === "computer-use" || message.kind === "vision-computer-use") {
    return `bot tool ${message.kind}`;
  }
  if (message.kind === "vision") {
    return "bot vision";
  }
  if (message.kind === "assistant-fallback") {
    return "bot assistant-fallback";
  }
  return "bot";
}

function renderTaskList(tasks) {
  const list = document.querySelector('[data-role="task-list"]');
  taskRuntimeItems = normalizeRuntimeTaskItems(tasks);
  syncTaskCardFromGoals(taskGoals, mergedRuntimeTaskItems());
  if (!list) {
    return;
  }
  list.replaceChildren();
  tasks.filter((task) => task.visible_in_chat).forEach((task) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong></strong><span></span><small></small>`;
    item.querySelector("strong").textContent = task.executor_agent;
    item.querySelector("span").textContent = ` ${task.status} · ${task.summary}`;
    item.querySelector("small").textContent = `${task.timeout_ms}ms`;
    list.append(item);
  });
}

// MCP/SKILL 管理：搜索关键词 + 分类筛选（marketplace 风格，参考 Claude Code Discover）。
let toolCatalogSearch = "";
let toolCatalogCategoryFilter = "all";

// CLI / MCP / Skill 三个分组：把 5 个 catalog 分类归并到 3 个下拉。
const TOOL_GROUP_DEFS = [
  { key: "cli", label: "CLI 工具", categories: ["core-tools", "vision-tools", "computer-use"] },
  { key: "mcp", label: "MCP 工具", categories: ["plugins"] },
  { key: "skill", label: "Skill", categories: ["skills"] },
];

function toolGroupItems(catalog, def, query) {
  const items = [];
  (catalog.categories || []).forEach((category) => {
    if (!def.categories.includes(category.id)) {
      return;
    }
    (category.items || []).forEach((item) => {
      if (query) {
        const haystack = `${item.name || ""} ${item.display_name || ""} ${item.summary || ""} ${item.source_label || item.source || ""}`.toLowerCase();
        if (!haystack.includes(query)) {
          return;
        }
      }
      items.push(item);
    });
  });
  return items;
}

// 详情弹窗：展示选中工具的状态、功能介绍、使用方法、权限。
async function showToolDetailModal(toolId) {
  let item = null;
  try {
    const detail = await requestJson(`/api/tools/${encodeURIComponent(toolId)}`);
    item = detail?.item || null;
  } catch (error) {
    item = null;
  }
  document.querySelector('[data-role="tool-detail-modal"]')?.remove();
  const overlay = document.createElement("div");
  overlay.className = "tool-detail-modal";
  overlay.dataset.role = "tool-detail-modal";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  const card = document.createElement("div");
  card.className = "tool-detail-card";
  const header = document.createElement("header");
  const heading = document.createElement("strong");
  heading.textContent = item ? item.display_name || item.name || toolId : toolId;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "tool-detail-close";
  close.textContent = "×";
  close.addEventListener("click", () => overlay.remove());
  header.append(heading, close);
  card.append(header);

  if (!item) {
    const failed = document.createElement("p");
    failed.textContent = "工具详情加载失败。";
    card.append(failed);
  } else {
    const meta = document.createElement("div");
    meta.className = "tool-detail-meta";
    [
      `状态：${toolStatusLabel(item.status)}`,
      `风险：${toolRiskLabel(item.risk)}`,
      `来源：${item.source_label || item.source || "—"}`,
      item.executable_now ? "可直接调用" : "暂不可调用",
    ].forEach((text) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = text;
      meta.append(pill);
    });
    card.append(meta);

    const usage =
      item.action_hint ||
      (item.command ? `${item.command} ${(item.args || []).join(" ")}`.trim() : "") ||
      "—";
    const sections = [
      ["功能介绍", item.summary || "—", false],
      ["使用方法", usage, true],
      ["权限", (item.permissions || []).join(", ") || "—", false],
    ];
    sections.forEach(([title, body, mono]) => {
      const h = document.createElement("h4");
      h.textContent = title;
      const p = document.createElement(mono ? "pre" : "p");
      p.textContent = body;
      card.append(h, p);
    });
    if ((item.notes || []).length > 0) {
      const h = document.createElement("h4");
      h.textContent = "说明";
      const ul = document.createElement("ul");
      item.notes.forEach((note) => {
        const li = document.createElement("li");
        li.textContent = note;
        ul.append(li);
      });
      card.append(h, ul);
    }
  }

  overlay.append(card);
  document.body.append(overlay);
}

function localModeLabel(mode) {
  return (
    { chat: "本地文本推理", vision: "视觉(UI-DETR/ShowUI)", mixed: "混合", off: "全部关闭" }[mode] ||
    mode ||
    "未知"
  );
}

function appendLocalModelsMessage(host, message, isError = false) {
  if (!host || !message) {
    return;
  }
  host.querySelectorAll(".local-models-message.is-live").forEach((node) => node.remove());
  const node = document.createElement("div");
  node.className = `local-models-message is-live${isError ? " is-error" : ""}`;
  node.textContent = message;
  host.append(node);
}

async function pollLocalModelsMode(requestedMode, initialStatus = null) {
  let status = initialStatus;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const host = document.querySelector('[data-role="local-models"]');
    status = await requestJson("/api/local-models/status");
    if (requestedMode === "off" || status.active_mode === requestedMode) {
      await renderLocalModelsSwitch(status);
      return status;
    }
    appendLocalModelsMessage(
      host,
      `切换请求已发送，当前仍为 ${localModeLabel(status.active_mode)}，继续等待 ${localModeLabel(requestedMode)}…`,
    );
    await delay(2_000);
  }
  await renderLocalModelsSwitch(status);
  appendLocalModelsMessage(
    document.querySelector('[data-role="local-models"]'),
    `切换请求已发送，但 ${localModeLabel(requestedMode)} 尚未就绪，请查看服务日志或稍后刷新。`,
    true,
  );
  return status;
}

// 本地模型服务开关：chat / vision / off + 实时服务状态。
async function renderLocalModelsSwitch(prefetchedStatus = null) {
  const host = document.querySelector('[data-role="local-models"]');
  if (!host) {
    return;
  }
  let status = prefetchedStatus;
  try {
    status = status || await requestJson("/api/local-models/status");
  } catch (error) {
    const inventoryStatus = bindings.get("tools.localModel");
    if (inventoryStatus) {
      inventoryStatus.textContent = "异常";
      inventoryStatus.classList.remove("is-online");
      inventoryStatus.classList.add("is-offline");
    }
    host.replaceChildren();
    const title = document.createElement("div");
    title.className = "local-models-title";
    title.textContent = "本地模型服务";
    host.append(title);
    appendLocalModelsMessage(host, `状态加载失败：${error.message}`, true);
    return;
  }
  const inventoryStatus = bindings.get("tools.localModel");
  if (inventoryStatus) {
    const online = Boolean(status && status.active_mode && status.active_mode !== "off");
    inventoryStatus.textContent = online ? "在线" : "未启用";
    inventoryStatus.classList.toggle("is-online", online);
    inventoryStatus.classList.toggle("is-offline", !online);
  }
  host.replaceChildren();

  const title = document.createElement("div");
  title.className = "local-models-title";
  title.textContent = "本地模型服务（8GB 显存单活跃）";
  if (status) {
    const cur = document.createElement("b");
    cur.textContent = `当前：${localModeLabel(status.active_mode)}`;
    title.append(cur);
  }
  host.append(title);

  const pathRow = document.createElement("div");
  pathRow.className = "local-model-path-row";
  const pathInput = document.createElement("input");
  pathInput.type = "text";
  pathInput.className = "local-model-path-input";
  pathInput.setAttribute("data-role", "local-model-path");
  pathInput.placeholder = "选择 .gguf 本地模型文件";
  pathInput.value = status?.model_path || "";
  pathInput.title = pathInput.value;
  pathInput.classList.toggle("is-missing", Boolean(pathInput.value) && !status?.model_path_exists);

  const pickButton = document.createElement("button");
  pickButton.type = "button";
  pickButton.className = "mini-button";
  pickButton.textContent = "选择文件";
  pickButton.addEventListener("click", async () => {
    pickButton.disabled = true;
    try {
      const updated = await requestJson("/api/local-models/pick-model-file", { method: "POST" });
      await renderLocalModelsSwitch(updated);
    } catch (error) {
      appendLocalModelsMessage(host, `选择模型文件失败：${error.message}`, true);
      pickButton.disabled = false;
    }
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "mini-button is-primary-control";
  saveButton.textContent = "保存路径";
  saveButton.addEventListener("click", async () => {
    const modelPath = host.querySelector('[data-role="local-model-path"]')?.value?.trim() || "";
    saveButton.disabled = true;
    try {
      const updated = await requestJson("/api/local-models/model-path", {
        method: "POST",
        body: JSON.stringify({ model_path: modelPath }),
      });
      await renderLocalModelsSwitch(updated);
    } catch (error) {
      appendLocalModelsMessage(host, `保存模型路径失败：${error.message}`, true);
      saveButton.disabled = false;
    }
  });
  pathRow.append(pathInput, pickButton, saveButton);
  host.append(pathRow);

  const buttons = document.createElement("div");
  buttons.className = "local-models-buttons";
  [
    ["chat", "本地文本推理"],
    ["vision", "视觉 (UI-DETR/ShowUI)"],
    ["off", "全部关闭"],
  ].forEach(([mode, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `local-mode-btn${status && status.active_mode === mode ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", async () => {
      buttons.querySelectorAll("button").forEach((node) => {
        node.disabled = true;
      });
      button.textContent = "切换中…";
      try {
        const switched = await requestJson("/api/local-models/switch", {
          method: "POST",
          body: JSON.stringify({ mode }),
        });
        await renderLocalModelsSwitch(switched);
        await pollLocalModelsMode(mode, switched);
      } catch (error) {
        await renderLocalModelsSwitch();
        appendLocalModelsMessage(
          document.querySelector('[data-role="local-models"]'),
          `切换失败：${error.message}`,
          true,
        );
      }
    });
    buttons.append(button);
  });
  host.append(buttons);

  if (status) {
    const list = document.createElement("div");
    list.className = "local-models-status";
    (status.services || []).forEach((service) => {
      const chip = document.createElement("span");
      chip.className = `local-svc${service.running ? " is-on" : ""}`;
      chip.textContent = `${service.name} · ${service.running ? "运行" : "停"}`;
      list.append(chip);
    });
    host.append(list);
    if (status.message && status.message !== "ok") {
      const msg = document.createElement("div");
      msg.className = "local-models-message";
      msg.textContent = status.message;
      host.append(msg);
    }
  }
}

function renderToolsCatalog(catalog) {
  const host = document.querySelector('[data-role="tool-catalog"]');
  if (!host) {
    return;
  }
  host.replaceChildren();

  // 搜索框：过滤三个分组下拉里已安装的工具。
  const controls = document.createElement("div");
  controls.className = "tool-catalog-controls";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "tool-catalog-search";
  search.placeholder = "搜索已安装的 CLI / MCP / Skill 工具…";
  search.value = toolCatalogSearch;
  search.addEventListener("input", (event) => {
    toolCatalogSearch = event.target.value;
    renderToolsCatalog(catalog);
    const next = document.querySelector(".tool-catalog-search");
    if (next) {
      next.focus();
      const end = next.value.length;
      next.setSelectionRange(end, end);
    }
  });
  controls.append(search);
  host.append(controls);

  // CLI / MCP / Skill 三个紧凑下拉，各带「详情」按钮。
  const query = toolCatalogSearch.trim().toLowerCase();
  let matchedTotal = 0;
  TOOL_GROUP_DEFS.forEach((def) => {
    const items = toolGroupItems(catalog, def, query);
    matchedTotal += items.length;

    const row = document.createElement("div");
    row.className = "tool-group-row";

    const label = document.createElement("span");
    label.className = "tool-group-label";
    label.textContent = def.label;
    const count = document.createElement("b");
    count.className = "tool-group-count";
    count.textContent = String(items.length);
    label.append(count);

    const select = document.createElement("select");
    select.className = "tool-group-select";
    select.dataset.group = def.key;
    if (items.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = query ? "无匹配" : "（无）";
      select.append(opt);
      select.disabled = true;
    } else {
      items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = `[${toolStatusLabel(item.status)}] ${item.display_name || item.name}`;
        select.append(opt);
      });
    }

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "tool-group-detail-btn";
    detailBtn.textContent = "详情";
    detailBtn.disabled = items.length === 0;
    detailBtn.addEventListener("click", () => {
      if (select.value) {
        showToolDetailModal(select.value);
      }
    });

    row.append(label, select, detailBtn);
    host.append(row);
  });

  if (matchedTotal === 0 && query) {
    const empty = document.createElement("div");
    empty.className = "tool-catalog-empty";
    empty.textContent = `没有匹配“${toolCatalogSearch.trim()}”的工具`;
    host.append(empty);
  }
}

function renderToolItem(item) {
  const row = document.createElement("article");
  row.className = `tool-item risk-${item.risk || "medium"} status-${item.status || "unknown"}`;
  row.dataset.toolId = item.id;

  const main = document.createElement("div");
  main.className = "tool-item-main";
  const name = document.createElement("strong");
  name.textContent = item.display_name || item.name;
  const meta = document.createElement("span");
  meta.textContent = `${toolStatusLabel(item.status)} · ${item.source_label || item.source} · ${toolRiskLabel(item.risk)}`;
  main.append(name, meta, renderToolCallIndicator(item.id, item.display_name || item.name || item.id));

  const actions = document.createElement("div");
  actions.className = "tool-item-actions";
  (item.actions || []).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mini-button tool-action ${action.enabled ? "" : "is-disabled"}`;
    button.dataset.toolAction = action.id;
    button.dataset.toolId = item.id;
    button.disabled = !action.enabled;
    button.title = action.hint || "";
    button.textContent = action.label;
    actions.append(button);
  });

  const detail = document.createElement("div");
  detail.className = "tool-item-detail";
  detail.hidden = true;
  detail.append(renderToolDetail(item));

  row.append(main, actions, detail);
  return row;
}

function renderToolDetail(item, source = "catalog") {
  const box = document.createElement("div");
  box.className = "tool-detail-box";

  const summary = document.createElement("p");
  summary.textContent = item.summary || "暂无说明。";
  box.append(summary);

  const apiTrace = document.createElement("small");
  apiTrace.className = "tool-detail-api-trace";
  apiTrace.textContent = source === "detail-api" ? "Detail loaded from /api/tools/{tool_id}" : "Catalog summary";
  box.append(apiTrace);

  const chips = document.createElement("div");
  chips.className = "tool-detail-chips";
  [item.category_name, item.source_label, ...(item.permissions || [])].filter(Boolean).forEach((label) => {
    const chip = document.createElement("span");
    chip.textContent = label;
    chips.append(chip);
  });
  box.append(chips);

  if (item.input_schema) {
    const schema = document.createElement("pre");
    schema.className = "tool-schema";
    schema.textContent = schemaSummary(item.input_schema);
    box.append(schema);
  }

  if (item.children?.length) {
    const children = document.createElement("div");
    children.className = "tool-children";
    item.children.slice(0, 4).forEach((child) => {
      const childNode = document.createElement("p");
      childNode.textContent = `${child.display_name || child.name}: ${child.summary || child.status}`;
      children.append(childNode);
    });
    box.append(children);
  }

  const notes = [...(item.notes || []), ...(item.migration_notes || [])].filter(Boolean);
  if (notes.length) {
    const noteList = document.createElement("ul");
    noteList.className = "tool-notes";
    notes.slice(0, 4).forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      noteList.append(li);
    });
    box.append(noteList);
  }

  // P1: context 成本估算 + 安装（对 plugins/skills 可安装项，参考 Claude Code 的 Will install + scope）。
  const costLine = document.createElement("div");
  costLine.className = "tool-detail-cost";
  costLine.textContent = `Context 成本估算: ~${estimateContextCost(item)} tokens`;
  box.append(costLine);

  const installable =
    item.category_id === "plugins" ||
    item.category_id === "skills" ||
    /plugin|skill/i.test(item.category_name || "");
  if (installable) {
    box.append(renderToolInstallBox(item));
  }

  return box;
}

function estimateContextCost(item) {
  const summaryLen = (item.summary || "").length;
  const schemaLen = item.input_schema ? JSON.stringify(item.input_schema).length : 0;
  const childCount = (item.children || []).length;
  // 粗估：内容字符≈token×4，子工具固定开销。
  return Math.max(50, Math.round((summaryLen + schemaLen) / 4) + childCount * 40);
}

function renderToolInstallBox(item) {
  const installBox = document.createElement("div");
  installBox.className = "tool-install-box";

  const willInstall = document.createElement("div");
  willInstall.className = "tool-will-install";
  const childCount = (item.children || []).length;
  const permCount = (item.permissions || []).length;
  willInstall.textContent = childCount
    ? `Will install: ${childCount} 个工具/技能 · 权限 ${permCount} 项`
    : `Will install: 权限 ${permCount} 项`;
  installBox.append(willInstall);

  const scopeRow = document.createElement("div");
  scopeRow.className = "tool-scope-row";
  const scopeLabel = document.createElement("span");
  scopeLabel.textContent = "安装范围:";
  scopeRow.append(scopeLabel);
  const scopeChips = document.createElement("div");
  scopeChips.className = "tool-scope-chips";
  [
    { id: "user", label: "用户" },
    { id: "project", label: "项目" },
    { id: "local", label: "本仓" },
  ].forEach((scope, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `tool-scope-chip${index === 0 ? " is-active" : ""}`;
    chip.dataset.scope = scope.id;
    chip.textContent = scope.label;
    chip.addEventListener("click", () => {
      scopeChips
        .querySelectorAll(".tool-scope-chip")
        .forEach((node) => node.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
    scopeChips.append(chip);
  });
  scopeRow.append(scopeChips);
  installBox.append(scopeRow);

  const installBtn = document.createElement("button");
  installBtn.type = "button";
  installBtn.className = "mini-button tool-install-btn";
  installBtn.textContent = "安装";
  installBtn.addEventListener("click", () => installCatalogItem(item, installBox, installBtn));
  installBox.append(installBtn);
  return installBox;
}

async function installCatalogItem(item, installBox, button) {
  const scope =
    installBox.querySelector(".tool-scope-chip.is-active")?.dataset.scope || "user";
  setBusy(button, true, "安装中");
  try {
    const response = await fetch("/api/plugins/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, category_id: item.category_id || "", scope }),
    });
    const data = await response.json().catch(() => ({}));
    installBox.querySelectorAll(".tool-install-result").forEach((node) => node.remove());
    const note = document.createElement("div");
    note.className = response.ok ? "tool-install-result" : "tool-install-result is-error";
    note.textContent = data.message || (response.ok ? "已处理" : `失败：HTTP ${response.status}`);
    installBox.append(note);
  } catch (error) {
    const note = document.createElement("div");
    note.className = "tool-install-result is-error";
    note.textContent = `安装失败：${error && error.message ? error.message : error}`;
    installBox.append(note);
  } finally {
    setBusy(button, false);
  }
}

function onToolCatalogClick(event) {
  const button = event.target.closest("[data-tool-action]");
  if (!button) {
    return;
  }
  if (button.dataset.toolAction === "dry-run") {
    runToolDryRun(button);
    return;
  }
  if (button.dataset.toolAction !== "inspect") {
    return;
  }
  loadToolDetail(button);
}

async function loadToolDetail(button) {
  const toolId = button.dataset.toolId;
  if (!toolId) {
    return;
  }
  const row = button.closest(".tool-item");
  const detail = row?.querySelector(".tool-item-detail");
  if (!detail) {
    return;
  }
  const expanded = !detail.hidden;
  document.querySelectorAll(".tool-item-detail").forEach((node) => {
    node.hidden = true;
  });
  if (expanded && toolDetailCache.has(toolId)) {
    return;
  }
  detail.hidden = false;
  setBusy(button, true, "Inspecting");
  try {
    const cached = toolDetailCache.get(toolId);
    const response = cached || (await requestJson(`/api/tools/${encodeURIComponent(toolId)}`));
    if (!cached) {
      toolDetailCache.set(toolId, response);
    }
    detail.replaceChildren(renderToolDetail(response.item || response, "detail-api"));
  } catch (error) {
    const errorBox = document.createElement("div");
    errorBox.className = "tool-detail-error";
    errorBox.textContent = `Detail API failed: ${error.message}`;
    detail.replaceChildren(errorBox);
  } finally {
    setBusy(button, false);
  }
}

async function runToolSemanticDispatch(event) {
  const button = event?.currentTarget || actionButtons.get("tool-dispatch-run");
  const input = document.querySelector('[data-role="tool-dispatch-intent"]');
  const output = document.querySelector('[data-role="tool-dispatch-output"]');
  const intent = input?.value?.trim() || "Ctrl+L hotkey focus browser address bar";
  const dispatchToolId = "tools.semantic_dispatch";
  if (output) {
    output.textContent = "POST /api/tools/dispatch\nPlanning dry-run...";
  }
  setToolCallStatus(dispatchToolId, "running", "Semantic dispatch");
  setBusy(button, true, "Planning");
  try {
    const response = await requestJson("/api/tools/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        execute: false,
        confirm_after: true,
        roi_radius: 64,
        use_latest_capture: true,
      }),
    });
    if (output) {
      output.textContent = formatToolDispatchResult(response);
    }
    setToolCallStatus(dispatchToolId, "complete", "Semantic dispatch");
    if (response.tool_id && response.tool_id !== dispatchToolId) {
      setToolCallStatus(response.tool_id, "complete", response.tool_id);
    }
  } catch (error) {
    if (output) {
      output.textContent = `Dispatch failed: ${error.message}`;
    }
    setToolCallStatus(dispatchToolId, "error", "Semantic dispatch");
  } finally {
    setBusy(button, false);
  }
}

function formatToolDispatchResult(response) {
  const plan = response?.dispatch_plan;
  const lines = [
    `route: ${response?.route || "unknown"}`,
    `status: ${response?.status || "unknown"}`,
  ];
  if (response?.scenario) {
    lines.push(`scenario: ${response.scenario}`);
  }
  if (plan) {
    lines.push(`tool_id: ${plan.tool_id}`);
    lines.push(`action: ${plan.action}`);
    lines.push(`execute_allowed: ${plan.execute_allowed ? "true" : "false"}`);
    lines.push(`safety_gate: ${plan.safety_gate || "n/a"}`);
    const action = plan.action_plan || {};
    if (action.target || action.point || action.steps) {
      lines.push(`target: ${action.target || "-"}`);
      lines.push(`point: ${action.point ? `${action.point.x},${action.point.y}` : "-"}`);
      lines.push(`steps: ${action.steps ?? "-"}`);
    }
    if (plan.llm_tool_call?.name) {
      lines.push(`llm_tool_call: ${plan.llm_tool_call.name}`);
    }
  }
  (response?.notes || []).slice(0, 4).forEach((note) => lines.push(`note: ${note}`));
  return lines.join("\n");
}

function renderToolScenarioMatrix(catalog) {
  const host = document.querySelector('[data-role="tool-scenario-matrix"]');
  if (!host) {
    return;
  }
  const items = flattenToolCatalog(catalog);
  const hasTool = (id) => items.some((item) => item.id === id);
  const rows = [
    {
      scenario: "Workspace read",
      tools: ["core.read_file", "core.glob_search", "core.grep_search"].filter(hasTool).join(" / ") || "core read-only tools",
      permission: "ReadOnly",
      verify: "audit row + preview output",
    },
    {
      scenario: "Semantic routing",
      tools: hasTool("tools.semantic_dispatch") ? "tools.semantic_dispatch" : "POST /api/tools/dispatch",
      permission: "Dry-run only",
      verify: "dispatch_plan + no real input",
    },
    {
      scenario: "Grounded UI action",
      tools: ["vision.find_target", "computer.visual_action", "computer.closed_loop"].filter(hasTool).join(" / ") || "vision + computer-use",
      permission: "Timed input grant",
      verify: "locate evidence + confirmation",
    },
    {
      scenario: "Protected writes",
      tools: "runtime-execute + approval SSE",
      permission: "WorkspaceWrite / Protected",
      verify: "pending approval + audit trail",
    },
    {
      scenario: "Multi-agent counting",
      tools: "chat dispatch + goal roster context",
      permission: "Conversation only",
      verify: "ordered targets + isolated rosters; covered by multi_agent_counting_dispatch_preserves_requested_order",
    },
  ];

  host.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "Scenario / permission matrix";
  host.append(title);
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "tool-scenario-row";
    const heading = document.createElement("b");
    heading.textContent = row.scenario;
    const tools = document.createElement("span");
    tools.textContent = row.tools;
    const meta = document.createElement("small");
    meta.textContent = `${row.permission} · ${row.verify}`;
    item.append(heading, tools, meta);
    host.append(item);
  });
}

function flattenToolCatalog(catalog) {
  return (catalog?.categories || []).flatMap((category) => category.items || []);
}

async function runToolDryRun(button) {
  const toolId = button.dataset.toolId;
  if (!toolId) {
    return;
  }
  setBusy(button, true, "运行中");
  try {
    const result = await requestJson(`/api/tools/${encodeURIComponent(toolId)}/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: defaultToolDryRunInput(toolId) }),
    });
    const summary = summarizeToolDryRun(result);
    addMessage({
      author: "工具卡片 dry-run",
      text: summary,
      kind: result.status === "完成" ? "bot" : "thought",
      icon: result.status === "完成" ? "result" : "warn-log",
    });
    const row = button.closest(".tool-item");
    const detail = row?.querySelector(".tool-item-detail");
    if (detail) {
      detail.hidden = false;
      let output = detail.querySelector(".tool-run-output");
      if (!output) {
        output = document.createElement("pre");
        output.className = "tool-run-output";
        detail.append(output);
      }
      output.textContent = JSON.stringify(result.output, null, 2);
    }
    if (toolId.startsWith("vision.")) {
      await refreshState();
    }
  } catch (error) {
    addMessage({
      author: "工具卡片 dry-run",
      text: `${toolId} 预演失败：${error.message}`,
      kind: "thought",
      icon: "error-log",
    });
  } finally {
    setBusy(button, false);
  }
}

function defaultToolDryRunInput(toolId) {
  const map = {
    "vision.capture_desktop": {},
    "vision.describe_screen": {},
    "vision.find_target": {
      target: "gold CONFIRM button",
      raw_response: '{"bbox":[0.35,0.42,0.65,0.58],"confidence":0.86,"label":"CONFIRM"}',
      use_latest_capture: true,
      use_model: false,
    },
    "vision.find_region": {
      target: "screen area to drag select",
      raw_response: '{"bbox":[0.22,0.24,0.52,0.48],"confidence":0.82,"label":"selectable region"}',
      use_latest_capture: true,
      use_model: false,
    },
    "computer.safe_context_menu": { execute: false, layout: "random" },
    "computer.safe_drag_select": { execute: false, layout: "random" },
    "computer.left_click": { x: 200, y: 180 },
    "computer.right_click": { x: 200, y: 180 },
    "computer.double_click": { x: 200, y: 180 },
    "computer.context_menu_select": {
      target: "desktop icon",
      menu_item: "Properties",
      x: 200,
      y: 180,
    },
    "computer.drag_select": {
      start: { x: 220, y: 220 },
      end: { x: 520, y: 420 },
    },
    "computer.visual_action": {
      target: "gold CONFIRM button",
      action: "left_click",
    },
    "computer.scroll": { delta: -480, x: 420, y: 360 },
    "computer.text_input": {
      target: "browser address bar",
      text: "https://example.com",
      x: 420,
      y: 88,
    },
    "computer.press_key": { key: "Enter" },
    "computer.hotkey": { keys: ["Ctrl", "L"] },
    "computer.closed_loop": {
      scenario: "desktop-icon-left-click",
      execute: false,
      confirm_after: true,
      roi_radius: 64,
    },
    "computer.profile": {
      scenario: "desktop-icon-left-click",
      execute: false,
      confirm_after: true,
      roi_radius: 64,
      after_delay_ms: 120,
    },
    "tools.semantic_dispatch": {
      intent: "请看一下当前桌面并 dry-run 点击目标",
      execute: false,
      confirm_after: true,
      roi_radius: 64,
    },
    "core.read_file": { path: "docs/requirements-management.md", limit: 40 },
    "core.glob_search": { pattern: "*.md", path: "docs" },
    "core.grep_search": { pattern: "REQ-TOOL", path: "docs", head_limit: 20 },
    "core.ToolSearch": { query: "vision computer-use", max_results: 8 },
    "core.Sleep": { duration_ms: 0 },
  };
  return map[toolId] || {};
}

function summarizeToolDryRun(result) {
  const output = result.output || {};
  if (result.tool_id === "vision.find_target" || result.tool_id === "vision.find_region") {
    const grounding = output.grounding || {};
    const point = grounding.point ? `(${grounding.point.x}, ${grounding.point.y})` : "pending";
    const bbox = grounding.bbox ? `${grounding.bbox.width}x${grounding.bbox.height}` : "no bbox";
    return `${result.tool_id} dry-run 完成：${output.status || "ready"} point ${point} bbox ${bbox}`;
  }
  if (result.tool_id === "computer.safe_context_menu") {
    const itemPoint = output.menu_item_point
      ? `(${output.menu_item_point.x}, ${output.menu_item_point.y})`
      : "pending";
    return `${result.tool_id} dry-run complete: ${output.status || "ready"} ACTION ${output.target_number || "?"} at ${itemPoint}, executed=${output.executed ? "yes" : "no"}`;
  }
  if (result.tool_id === "computer.safe_drag_select") {
    const start = output.start ? `(${output.start.x}, ${output.start.y})` : "pending";
    const end = output.end ? `(${output.end.x}, ${output.end.y})` : "pending";
    const points = Array.isArray(output.path) ? output.path.length : 0;
    return `${result.tool_id} dry-run complete: ${output.status || "ready"} ${start} -> ${end}, path points=${points}, executed=${output.executed ? "yes" : "no"}`;
  }
  if ([
    "computer.left_click",
    "computer.right_click",
    "computer.double_click",
    "computer.context_menu_select",
    "computer.drag_select",
    "computer.visual_action",
    "computer.scroll",
    "computer.text_input",
    "computer.press_key",
    "computer.hotkey",
  ].includes(result.tool_id)) {
    const point = output.point ? `(${output.point.x}, ${output.point.y})` : "pending";
    const steps = Array.isArray(output.action_steps) ? output.action_steps.length : 0;
    return `${result.tool_id} dry-run 完成：${output.action || "action"} ${point}，步骤 ${steps}，真实执行 ${output.executed ? "是" : "否"}`;
  }
  if (result.tool_id === "vision.capture_desktop" || result.tool_id === "vision.describe_screen") {
    const capture = output.capture || {};
    return `${result.tool_id} dry-run 完成：截图 ${capture.exists ? "可用" : "未找到"}，${capture.bytes || 0} bytes，预览 ${capture.preview_url || "无"}`;
  }
  if (result.tool_id === "computer.closed_loop" || result.tool_id === "tools.semantic_dispatch") {
    const plan = output.dispatch_plan;
    if (plan) {
      const action = plan.action_plan || {};
      const point = action.point ? `(${action.point.x}, ${action.point.y})` : "pending";
      const pathPoints = Array.isArray(action.path) ? action.path.length : 0;
      const call = plan.llm_tool_call?.name || plan.tool_id;
      return `${result.tool_id} dry-run complete: ${call} ${plan.action} ${point}, path=${pathPoints}, execute=${plan.execute_allowed ? "enabled" : "disabled"}`;
    }
    const loop = output.closed_loop || output;
    const point = loop.point ? `(${loop.point.x}, ${loop.point.y})` : "未生成";
    return `${result.tool_id} dry-run 完成：${loop.target || loop.route || "工具路由"} ${loop.action || ""} ${point}`;
  }
  if (result.tool_id === "computer.profile") {
    return `${result.tool_id} dry-run 完成：总耗时 ${output.total_elapsed_ms || result.elapsed_ms}ms，真实执行 ${output.executed ? "是" : "否"}`;
  }
  if (result.tool_id === "core.glob_search") {
    return `${result.tool_id} dry-run 完成：匹配 ${output.numFiles ?? output.num_files ?? 0} 个文件。`;
  }
  if (result.tool_id === "core.grep_search") {
    return `${result.tool_id} dry-run 完成：匹配 ${output.numMatches ?? output.num_matches ?? 0} 处。`;
  }
  return `${result.tool_id} dry-run 完成，用时 ${result.elapsed_ms}ms。`;
}

function schemaSummary(schema) {
  const required = Array.isArray(schema.required) ? schema.required.join(", ") : "";
  const properties = schema.properties ? Object.keys(schema.properties).join(", ") : "";
  return [
    `type: ${schema.type || "object"}`,
    required ? `required: ${required}` : null,
    properties ? `properties: ${properties}` : null,
  ].filter(Boolean).join("\n");
}

function toolStatusLabel(status) {
  const labels = {
    available: "可用",
    candidate: "候选",
    disabled: "未启用",
    planned: "规划中",
    invalid: "异常",
    "dry-run-gated": "需闸门",
  };
  return labels[status] || status || "未知";
}

function toolRiskLabel(risk) {
  const labels = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  return labels[risk] || "中风险";
}

function renderProfile(result) {
  setText("profile.total", `${result.total_elapsed_ms}ms`);
  const list = document.querySelector('[data-role="profile-phases"]');
  if (!list) {
    return;
  }
  list.replaceChildren();
  result.phases.forEach((phase) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong></strong><span></span>`;
    item.querySelector("strong").textContent = `${phase.name}: ${phase.elapsed_ms}ms`;
    item.querySelector("span").textContent = ` ${phase.status} · ${phase.description}`;
    list.append(item);
  });
}

function getSelectedAgentIds() {
  const checked = document.querySelectorAll('[data-role="agent-targets"] input[type="checkbox"]:checked');
  return Array.from(checked).map((checkbox) => checkbox.value);
}

function updateAgentTriggerText() {
  const trigger = document.querySelector('[data-role="agent-trigger"]');
  if (!trigger) {
    return;
  }
  const checked = document.querySelectorAll('[data-role="agent-targets"] input[type="checkbox"]:checked');
  const names = Array.from(checked).map((checkbox) => {
    const agent = agentRegistry?.agents?.find((a) => a.id === checkbox.value);
    return agent?.name || checkbox.value;
  });
  trigger.textContent = names.length ? `${names.join(", ")} ▾` : "发送给 ▾";
}

function updateSessionTrigger(label) {
  const trigger = document.querySelector('[data-role="session-trigger"]');
  if (trigger && label) {
    trigger.textContent = label;
  }
}

function updateChatRoomTrigger(label) {
  const trigger = document.querySelector('[data-role="chat-room-trigger"]');
  if (trigger && label) {
    trigger.textContent = label;
  }
}

function renderProjectTree(entries) {
  renderProjectApiTree(normalizeProjectTreeEntries(entries));
}

function normalizeProjectTreeEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const kind = entry.kind === "dir" || entry.kind === "directory" ? "dir" : "file";
    const relativePath = entry.relative_path || entry.path || entry.name || "";
    const fileSize = Number.isFinite(entry.file_size)
      ? entry.file_size
      : Number.isFinite(entry.size)
        ? entry.size
        : undefined;
    return {
      ...entry,
      name: entry.name || relativePath || "(root)",
      relative_path: relativePath,
      kind,
      file_size: fileSize,
      children: normalizeProjectTreeEntries(entry.children),
      omitted_count: entry.omitted_count || 0,
    };
  });
}

function projectTreeList() {
  return document.querySelector('[data-role="project-tree"]') || document.querySelector(".project-tree");
}

function projectPreviewText() {
  return document.querySelector('[data-role="project-file-preview"]');
}

function projectPreviewMeta() {
  return document.querySelector('[data-role="project-file-meta"]');
}

// 任务: 基础语法高亮关键字表（按语言）。
const SYNTAX_KEYWORDS = {
  rust: new Set(
    "fn let mut pub struct enum impl trait use mod match if else for while loop return self Self async await const static ref move where as dyn crate super in break continue type unsafe box".split(
      " "
    )
  ),
  js: new Set(
    "function let const var if else for while return class extends new this async await import export default from try catch finally throw typeof instanceof of in do switch case break continue yield null undefined true false void delete".split(
      " "
    )
  ),
  py: new Set(
    "def class if elif else for while return import from as try except finally raise with lambda yield pass break continue global nonlocal None True False and or not in is async await del".split(
      " "
    )
  ),
  default: new Set(
    "if else for while return function class import export const let var def fn pub struct enum impl true false null None void".split(
      " "
    )
  ),
};

function syntaxLangForPath(path) {
  const ext = (path || "").split(".").pop().toLowerCase();
  return (
    { rs: "rust", js: "js", mjs: "js", cjs: "js", ts: "js", jsx: "js", tsx: "js", py: "py", json: "js" }[
      ext
    ] || "default"
  );
}

// 轻量语法高亮（单行 token 扫描），生成安全 DOM（textContent，无 innerHTML 注入）。
function highlightLineFragment(lineText, keywords) {
  const frag = document.createDocumentFragment();
  const tokenRe =
    /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;
  let match;
  let guard = 0;
  while ((match = tokenRe.exec(lineText)) && guard++ < 50000) {
    let cls = null;
    if (match[1]) cls = "tok-comment";
    else if (match[2]) cls = "tok-string";
    else if (match[3]) cls = "tok-number";
    else if (match[4]) cls = keywords.has(match[4]) ? "tok-keyword" : null;
    if (cls) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = match[0];
      frag.append(span);
    } else {
      frag.append(document.createTextNode(match[0]));
    }
  }
  return frag;
}

// IDE 编辑器状态：当前载入段（行窗口）+ 截断标记，供 :n 跳转判定是否需远程加载。
const IDE_EDITOR_MAX_BYTES = 200 * 1024;
const IDE_EDITOR_LINE_WINDOW = 400;
let ideEditorState = { path: "", startLine: 1, lineCount: 0, truncated: false };

// 文件内容渲染：委托 renderIdeEditor（行号双栏 + :n 跳转）。保留原函数名兼容旧调用点。
function renderProjectContent(content, lang, meta = "") {
  renderIdeEditor(content, {
    lang,
    meta,
    path: selectedProjectPath,
    startLine: 1,
    highlightLine: null,
  });
}

// 行号 + 代码双栏渲染（plan §4.4）。gutter 用单块文本（保证万行文件滚动 60fps），
// 定宽按最大行号位数；code 逐行（保留行内搜索命中能力）；行号点击复制 path:line。
function renderIdeEditor(content, opts = {}) {
  const {
    lang = "default",
    meta = "",
    path = "",
    startLine = 1,
    highlightLine = null,
    forceTruncated = false,
    truncationNote = "",
  } = opts;
  const preview = projectPreviewText();
  if (!preview) {
    return;
  }
  preview.classList.remove("is-diff");
  preview.classList.add("is-code");

  const text = content || "";
  const allLines = text.split("\n");
  // >200KB 截断展示前 200KB（按完整行切，保留截断提示）。
  let truncated = forceTruncated;
  let displayLines = allLines;
  let effectiveStart = startLine;
  if (!forceTruncated && path && startLine === 1 && text.length > IDE_EDITOR_MAX_BYTES) {
    let len = 0;
    let cut = allLines.length;
    for (let i = 0; i < allLines.length; i++) {
      len += allLines[i].length + 1;
      if (len > IDE_EDITOR_MAX_BYTES) {
        cut = i;
        break;
      }
    }
    if (cut < allLines.length) {
      displayLines = allLines.slice(0, cut);
      truncated = true;
    }
  }
  ideEditorState = {
    path,
    startLine: effectiveStart,
    lineCount: displayLines.length,
    truncated,
  };

  const editor = document.createElement("div");
  editor.className = "ide-editor";
  editor.dataset.role = "ide-editor";

  const lastNo = effectiveStart + displayLines.length - 1;
  const gutter = document.createElement("pre");
  gutter.className = "ide-gutter";
  const nums = [];
  for (let n = effectiveStart; n <= lastNo; n++) {
    nums.push(String(n));
  }
  gutter.textContent = nums.join("\n");
  gutter.style.minWidth = `${String(lastNo).length}ch`;

  const surface = document.createElement("div");
  surface.className = "ide-code-surface";
  const keywords = SYNTAX_KEYWORDS[lang] || SYNTAX_KEYWORDS.default;
  displayLines.forEach((line, idx) => {
    const row = document.createElement("div");
    row.className = "code-line";
    row.dataset.line = String(effectiveStart + idx);
    const code = document.createElement("span");
    code.className = "line-code";
    code.append(highlightLineFragment(line, keywords));
    row.append(code);
    surface.append(row);
  });

  if (truncated) {
    const notice = document.createElement("div");
    notice.className = "ide-truncate-notice";
    notice.textContent =
      truncationNote ||
      `大文件已截断展示前 ${Math.round(IDE_EDITOR_MAX_BYTES / 1024)}KB，:行号 跳转自动加载该段`;
    editor.append(notice);
  }

  editor.append(gutter, surface);
  preview.replaceChildren(editor);

  // 行号点击复制 path:line（按点击 Y / 行高估算行号）。
  gutter.addEventListener("click", (event) => {
    if (!path) {
      return;
    }
    const rect = gutter.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(gutter).lineHeight) || 18;
    const y = event.clientY - rect.top;
    const lineNo = Math.max(
      effectiveStart,
      Math.min(lastNo, Math.floor(y / lh) + effectiveStart)
    );
    const text = `${path}:${lineNo}`;
    try {
      navigator.clipboard?.writeText(text);
    } catch (_e) {
      /* clipboard 不可用时静默 */
    }
  });

  const metaNode = projectPreviewMeta();
  if (metaNode) {
    metaNode.textContent = meta || "";
  }

  if (highlightLine) {
    jumpToIdeLine(highlightLine, { smooth: true });
  }
  refreshIdeOutline(path);
}

// Phase 5 P4.1：符号大纲侧条——拉取当前文件全部符号（api_project_symbols?path=），点击跳行。
let ideOutlineSeq = 0;
function ideOutlineSetEmpty(text) {
  const listNode = document.querySelector('[data-role="ide-outline-list"]');
  const countNode = document.querySelector('[data-role="ide-outline-count"]');
  if (countNode) {
    countNode.textContent = "0";
  }
  if (!listNode) {
    return;
  }
  const empty = document.createElement("div");
  empty.className = "ide-outline-empty";
  empty.textContent = text;
  listNode.replaceChildren(empty);
}
async function refreshIdeOutline(path) {
  const seq = ++ideOutlineSeq;
  if (!path) {
    ideOutlineSetEmpty("选择文件查看符号大纲。");
    return;
  }
  let resp;
  try {
    resp = await requestJson(`/api/project/symbols?path=${encodeURIComponent(path)}&limit=500`);
  } catch (_error) {
    if (seq === ideOutlineSeq) {
      ideOutlineSetEmpty("大纲加载失败。");
    }
    return;
  }
  if (seq !== ideOutlineSeq) {
    return;
  }
  const listNode = document.querySelector('[data-role="ide-outline-list"]');
  const countNode = document.querySelector('[data-role="ide-outline-count"]');
  const symbols = Array.isArray(resp?.symbols) ? resp.symbols : [];
  if (countNode) {
    countNode.textContent = String(symbols.length);
  }
  if (!listNode) {
    return;
  }
  if (!symbols.length) {
    ideOutlineSetEmpty(resp?.needs_index ? "符号索引未构建，先在搜索框构建索引。" : "该文件暂无符号。");
    return;
  }
  const rows = symbols.map((symbol) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ide-outline-row";
    row.dataset.line = String(symbol.line || 1);
    const kind = document.createElement("i");
    kind.className = "ide-outline-kind";
    kind.textContent = (symbol.kind || "?").slice(0, 2);
    kind.title = symbol.kind || "";
    const name = document.createElement("span");
    name.className = "ide-outline-name";
    name.textContent = symbol.name || "";
    name.title = symbol.signature || symbol.name || "";
    const line = document.createElement("small");
    line.className = "ide-outline-line";
    line.textContent = String(symbol.line || "");
    row.append(kind, name, line);
    row.addEventListener("click", () => jumpToIdeLine(symbol.line, { smooth: true }));
    return row;
  });
  listNode.replaceChildren(...rows);
}

// :n 跳转：目标行在已载段内直接高亮滚屏；超出则按 ±400 行请求行窗口重新渲染。
function jumpToIdeLine(lineNo, { smooth = true } = {}) {
  if (!lineNo || lineNo < 1) {
    return false;
  }
  const editor = document.querySelector('.ide-editor[data-role="ide-editor"]');
  if (!editor) {
    return false;
  }
  const row = editor.querySelector(`.code-line[data-line="${lineNo}"]`);
  if (row) {
    flashIdeLine(row);
    row.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    return true;
  }
  if (ideEditorState.path) {
    fetchIdeLineWindow(ideEditorState.path, lineNo);
    return true;
  }
  return false;
}

function flashIdeLine(row) {
  row.classList.remove("ide-line-flash");
  void row.offsetWidth; // 强制 reflow 以重启动画
  row.classList.add("ide-line-flash");
  window.setTimeout(() => row.classList.remove("ide-line-flash"), 1300);
}

async function fetchIdeLineWindow(path, lineNo) {
  const start = Math.max(1, lineNo - IDE_EDITOR_LINE_WINDOW);
  const end = lineNo + IDE_EDITOR_LINE_WINDOW;
  try {
    const meta = await requestJson(
      `/api/project/file/meta?path=${encodeURIComponent(path)}`
    );
    if (!meta.previewable) {
      updateProjectPreview(
        "This file is binary or too large for inline preview.",
        "Line window fetch failed."
      );
      return;
    }
    const url = `/api/project/file?path=${encodeURIComponent(path)}&start_line=${start}&end_line=${end}`;
    const response = await requestJson(url);
    const metaText = `${meta.relative_path} · ${formatFileSize(meta.file_size)} · 行 ${response.start_line}-${response.end_line}/${response.total_lines || "?"}`;
    renderIdeEditor(response.content, {
      lang: syntaxLangForPath(path),
      meta: metaText,
      path,
      startLine: response.start_line || start,
      highlightLine: lineNo,
      forceTruncated: false,
      truncationNote: `已加载行 ${response.start_line}-${response.end_line}（共 ${response.total_lines || "?"} 行），:行号 可继续跳转`,
    });
  } catch (error) {
    updateProjectPreview(error.message, "Line window fetch failed.");
  }
}

function updateProjectPreview(content, meta = "") {
  const preview = projectPreviewText();
  if (preview) {
    preview.classList.remove("is-diff", "is-code");
    preview.textContent = content || "";
  }
  const metaNode = projectPreviewMeta();
  if (metaNode) {
    metaNode.textContent = meta || "";
  }
}

// === 阶段C：统一搜索框 omni-search（文件/@符号/:行）+ Ctrl+点击取词跳转（plan §4.3/§4.5） ===
let ideOmniState = {
  input: null,
  results: null,
  items: [],
  activeIndex: -1,
  debounceTimer: 0,
  pendingSeq: 0,
};

// 跨文件打开 + 跳行（阶段C 用；阶段E 多标签会扩展为真正的 view tab 管理）。
async function openViewTab(path, { line = null, smooth = true } = {}) {
  if (!path) {
    return;
  }
  await openProjectFile(path);
  if (line && line > 0) {
    // openProjectFile 已从头渲染；目标行若不在已载段，jumpToIdeLine 会按行窗口远程加载。
    jumpToIdeLine(line, { smooth });
  }
}

function initIdeOmniSearch() {
  const input = document.querySelector('[data-role="ide-omni-search"]');
  const results = document.querySelector('[data-role="ide-omni-results"]');
  if (!input || !results || input.dataset.bound === "1") {
    return;
  }
  input.dataset.bound = "1";
  ideOmniState.input = input;
  ideOmniState.results = results;

  input.addEventListener("input", () => {
    if (ideOmniState.debounceTimer) {
      window.clearTimeout(ideOmniState.debounceTimer);
    }
    ideOmniState.debounceTimer = window.setTimeout(() => {
      ideOmniState.debounceTimer = 0;
      runIdeOmniQuery(input.value);
    }, 160);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveIdeOmniActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveIdeOmniActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const value = (input.value || "").trim();
      // :123 —— 当前激活 tab 内跳行。
      const lineMatch = value.match(/^:(\d+)$/);
      if (lineMatch) {
        const lineNo = parseInt(lineMatch[1], 10);
        if (lineNo > 0) {
          jumpToIdeLine(lineNo, { smooth: true });
        }
        hideIdeOmniResults();
        input.blur();
        return;
      }
      activateIdeOmniItem();
    } else if (event.key === "Escape") {
      event.preventDefault();
      hideIdeOmniResults();
      input.blur();
    }
  });

  input.addEventListener("blur", () => {
    // 延迟隐藏，给 click/mousedown 留时间触发选中。
    window.setTimeout(() => {
      if (document.activeElement !== input) {
        hideIdeOmniResults();
      }
    }, 180);
  });

  // Ctrl+点击编辑器内标识符 → 取词 → 符号搜索 → 唯一命中直接跳、多命中弹浮层预填 @词。
  const preview = projectPreviewText();
  if (preview && preview.dataset.ideCtrlBound !== "1") {
    preview.dataset.ideCtrlBound = "1";
    preview.addEventListener("click", (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const word = extractIdeWordAtPoint(event.clientX, event.clientY);
      if (!word) {
        return;
      }
      event.preventDefault();
      ideCtrlClickJump(word);
    });
  }
}

// 解析 omni 输入并拉取结果。
async function runIdeOmniQuery(rawValue) {
  const input = ideOmniState.input;
  const value = (rawValue ?? "").trim();
  if (!value) {
    hideIdeOmniResults();
    return;
  }
  // :行号 模式：不弹下拉，回车时由 keydown 处理跳转。
  if (/^:\d+$/.test(value)) {
    hideIdeOmniResults();
    return;
  }
  const mySeq = ++ideOmniState.pendingSeq;
  let kind = "file";
  let query = value;
  let pendingLine = null;
  if (value.startsWith("@")) {
    kind = "symbol";
    query = value.slice(1).trim();
  } else {
    // foo :45 → 文件搜索 + 打开后跳 45 行。
    const m = value.match(/^(.*?)\s*:\s*(\d+)\s*$/);
    if (m) {
      query = m[1].trim();
      pendingLine = parseInt(m[2], 10);
    }
  }
  if (!query) {
    hideIdeOmniResults();
    return;
  }
  try {
    let resp;
    if (kind === "symbol") {
      resp = await requestJson(
        `/api/project/symbols?query=${encodeURIComponent(query)}&limit=50`
      );
    } else {
      resp = await requestJson(
        `/api/project/search-files?query=${encodeURIComponent(query)}&limit=50`
      );
    }
    if (mySeq !== ideOmniState.pendingSeq) {
      return; // 被更新的输入抢占
    }
    renderIdeOmniResults(kind, resp, pendingLine);
  } catch (error) {
    if (mySeq === ideOmniState.pendingSeq) {
      renderIdeOmniError(error.message || "search failed");
    }
  }
}

function renderIdeOmniError(message) {
  const box = ideOmniState.results;
  if (!box) return;
  box.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "ide-omni-empty";
  empty.textContent = message;
  box.append(empty);
  box.hidden = false;
  ideOmniState.items = [];
  ideOmniState.activeIndex = -1;
}

function renderIdeOmniResults(kind, resp, pendingLine) {
  const box = ideOmniState.results;
  if (!box || !ideOmniState.input) return;
  box.innerHTML = "";
  ideOmniState.items = [];
  ideOmniState.activeIndex = -1;

  const items = [];
  if (kind === "symbol") {
    const symbols = (resp && Array.isArray(resp.symbols)) ? resp.symbols : [];
    if (resp && resp.needs_index) {
      const empty = document.createElement("div");
      empty.className = "ide-omni-empty";
      empty.textContent = "符号索引未构建，请点击「索引」按钮后再搜索 @符号。";
      box.append(empty);
      box.hidden = false;
      return;
    }
    const ordered = orderIdeSymbolsForCurrent(symbols);
    ordered.forEach((sym) => {
      items.push({ kind: "symbol", data: sym });
    });
  } else {
    const files = (resp && Array.isArray(resp.files)) ? resp.files : [];
    files.forEach((file) => {
      items.push({ kind: "file", data: file, line: pendingLine });
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "ide-omni-empty";
    empty.textContent = "无匹配结果";
    box.append(empty);
    box.hidden = false;
    return;
  }

  items.forEach((item, index) => {
    const node = document.createElement("div");
    node.className = "ide-omni-item";
    node.setAttribute("role", "option");
    node.dataset.index = String(index);

    const main = document.createElement("div");
    main.className = "ide-omni-item-main";
    const nameSpan = document.createElement("span");
    nameSpan.className = "ide-omni-item-name";
    const pathSpan = document.createElement("span");
    pathSpan.className = "ide-omni-item-path";

    if (item.kind === "symbol") {
      nameSpan.textContent = item.data.name;
      const kindBadge = document.createElement("span");
      kindBadge.className = "ide-omni-item-kind";
      kindBadge.textContent = item.data.kind || "sym";
      main.append(nameSpan, kindBadge);
      pathSpan.textContent = `${item.data.path}:${item.data.line}`;
    } else {
      const path = item.data.path || "";
      nameSpan.textContent = path.split("/").pop() || path;
      const kindBadge = document.createElement("span");
      kindBadge.className = "ide-omni-item-kind";
      kindBadge.textContent = "file";
      main.append(nameSpan, kindBadge);
      pathSpan.textContent = item.line ? `${path}  ·  跳到 ${item.line} 行` : path;
    }
    node.append(main, pathSpan);

    node.addEventListener("mousedown", (event) => {
      event.preventDefault();
      ideOmniState.activeIndex = index;
      activateIdeOmniItem();
    });
    node.addEventListener("mouseenter", () => {
      ideOmniState.activeIndex = index;
      refreshIdeOmniActive();
    });
    box.append(node);
  });

  ideOmniState.items = items;
  ideOmniState.activeIndex = items.length ? 0 : -1;
  refreshIdeOmniActive();
  box.hidden = false;
}

function refreshIdeOmniActive() {
  const box = ideOmniState.results;
  if (!box) return;
  box.querySelectorAll(".ide-omni-item").forEach((node, index) => {
    node.classList.toggle("is-active", index === ideOmniState.activeIndex);
  });
  const active = box.querySelector(".ide-omni-item.is-active");
  if (active) {
    active.scrollIntoView({ block: "nearest" });
  }
}

function moveIdeOmniActive(delta) {
  const total = ideOmniState.items.length;
  if (!total) {
    return;
  }
  let next = ideOmniState.activeIndex + delta;
  if (next < 0) next = total - 1;
  if (next >= total) next = 0;
  ideOmniState.activeIndex = next;
  refreshIdeOmniActive();
}

function activateIdeOmniItem() {
  const item = ideOmniState.items[ideOmniState.activeIndex];
  if (!item) {
    return;
  }
  if (item.kind === "symbol") {
    openViewTab(item.data.path, { line: item.data.line });
  } else {
    openViewTab(item.data.path, { line: item.line || null });
  }
  hideIdeOmniResults();
  ideOmniState.input?.blur();
}

function hideIdeOmniResults() {
  if (ideOmniState.results) {
    ideOmniState.results.hidden = true;
    ideOmniState.results.innerHTML = "";
  }
  ideOmniState.items = [];
  ideOmniState.activeIndex = -1;
}

// 候选排序：当前文件优先、其次同目录、再全局（plan §4.5）。
function orderIdeSymbolsForCurrent(symbols) {
  const currentPath = ideEditorState.path || selectedProjectPath || "";
  const currentDir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/"))
    : "";
  return symbols.slice().sort((a, b) => {
    const aCur = a.path === currentPath ? 0 : 1;
    const bCur = b.path === currentPath ? 0 : 1;
    if (aCur !== bCur) return aCur - bCur;
    const aDir = currentDir && a.path.startsWith(currentDir + "/") ? 0 : 1;
    const bDir = currentDir && b.path.startsWith(currentDir + "/") ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return 0;
  });
}

// Ctrl+点击取词：在点击坐标处扩展 [A-Za-z_][A-Za-z0-9_]* 边界。
function extractIdeWordAtPoint(x, y) {
  let range = null;
  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode && pos.offsetNode.nodeType === Node.TEXT_NODE) {
      range = { node: pos.offsetNode, offset: pos.offset };
    }
  } else if (typeof document.caretRangeFromPoint === "function") {
    const r = document.caretRangeFromPoint(x, y);
    if (r && r.startContainer && r.startContainer.nodeType === Node.TEXT_NODE) {
      range = { node: r.startContainer, offset: r.startOffset };
    }
  }
  if (!range) {
    return null;
  }
  const text = range.node.textContent || "";
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (range.offset >= m.index && range.offset <= m.index + m[0].length) {
      return m[0];
    }
  }
  return null;
}

async function ideCtrlClickJump(word) {
  if (!word) return;
  const mySeq = ++ideOmniState.pendingSeq;
  let resp;
  try {
    resp = await requestJson(
      `/api/project/symbols?query=${encodeURIComponent(word)}&limit=50`
    );
  } catch (error) {
    renderIdeOmniError(error.message || "symbol search failed");
    return;
  }
  if (mySeq !== ideOmniState.pendingSeq) {
    return;
  }
  if (resp && resp.needs_index) {
    renderIdeOmniError(`符号索引未构建，无法跳转「${word}」，请先点击「索引」按钮。`);
    return;
  }
  const symbols = (resp && Array.isArray(resp.symbols)) ? resp.symbols : [];
  if (!symbols.length) {
    renderIdeOmniError(`未找到符号「${word}」`);
    return;
  }
  const ordered = orderIdeSymbolsForCurrent(symbols);
  if (ordered.length === 1) {
    const sym = ordered[0];
    openViewTab(sym.path, { line: sym.line });
    return;
  }
  // 多命中：弹浮层预填 @词。
  if (ideOmniState.input) {
    ideOmniState.input.value = "@" + word;
    ideOmniState.input.focus();
  }
  renderIdeOmniResults("symbol", { symbols: ordered }, null);
}

// 目录树/文件栏宽度可拖拽调节（splitter 改 .project-layout 的 --project-tree-w）。
function initProjectSplitter() {
  const splitter = document.querySelector('[data-role="project-splitter"]');
  const layout = document.querySelector(".project-layout");
  if (!splitter || !layout || splitter.dataset.bound === "1") {
    return;
  }
  splitter.dataset.bound = "1";
  let dragging = false;
  splitter.addEventListener("mousedown", (event) => {
    dragging = true;
    event.preventDefault();
    document.body.style.cursor = "col-resize";
  });
  document.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }
    const rect = layout.getBoundingClientRect();
    const width = Math.max(140, Math.min(rect.width - 200, event.clientX - rect.left));
    layout.style.setProperty("--project-tree-w", `${width}px`);
  });
  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = "";
    }
  });
}

// 任务1 side-by-side diff：LCS 行对齐两份完整文本，生成 same/del/add 对齐行。
function diffAlignLines(leftLines, rightLines) {
  const n = leftLines.length;
  const m = rightLines.length;
  // 超大文件退化为按行号对齐，避免 O(n*m) 爆内存。
  if (n * m > 4000000) {
    const rows = [];
    const max = Math.max(n, m);
    for (let i = 0; i < max; i++) {
      const l = i < n ? leftLines[i] : null;
      const r = i < m ? rightLines[i] : null;
      const type = l === r ? "same" : l === null ? "add" : r === null ? "del" : "chg";
      rows.push({ type, left: l, right: r });
    }
    return rows;
  }
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        leftLines[i] === rightLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (leftLines[i] === rightLines[j]) {
      rows.push({ type: "same", left: leftLines[i], right: rightLines[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", left: leftLines[i], right: null });
      i++;
    } else {
      rows.push({ type: "add", left: null, right: rightLines[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", left: leftLines[i], right: null });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", left: null, right: rightLines[j] });
    j++;
  }
  return rows;
}

// 解析 unified diff 文本为 side-by-side 行（worktree diff 用）。
function parseUnifiedDiffRows(diffText) {
  const rows = [];
  diffText.split("\n").forEach((line) => {
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      return;
    }
    if (line.startsWith("@@")) {
      rows.push({ type: "hunk", left: line, right: line });
    } else if (line.startsWith("-")) {
      rows.push({ type: "del", left: line.slice(1), right: null });
    } else if (line.startsWith("+")) {
      rows.push({ type: "add", left: null, right: line.slice(1) });
    } else {
      const text = line.replace(/^ /, "");
      rows.push({ type: "same", left: text, right: text });
    }
  });
  return rows;
}

// side-by-side 渲染到共享预览区（两栏 + 差异高亮）。
function renderProjectDiffView(rows, meta = "") {
  const preview = projectPreviewText();
  if (preview) {
    preview.classList.add("is-diff");
    const surface = document.createElement("div");
    surface.className = "diff-sxs";
    // 阶段D：diff 模式下右半 50% 作为拖拽 dropzone（plan §4.6）。
    if (ideViewDiffMode === "diff") {
      surface.classList.add("is-ide-dropzone");
      surface.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types?.includes("text/coolzhu-path")) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        surface.classList.add("diff-dropzone-active");
      });
      surface.addEventListener("dragleave", (event) => {
        if (event.target === surface) {
          surface.classList.remove("diff-dropzone-active");
        }
      });
      surface.addEventListener("drop", (event) => {
        const path = event.dataTransfer?.getData("text/coolzhu-path")?.trim();
        if (!path) {
          return;
        }
        event.preventDefault();
        surface.classList.remove("diff-dropzone-active");
        void applyIdeDiffRight(path);
      });
    }
    rows.forEach((row) => {
      if (row.type === "hunk") {
        const hunk = document.createElement("div");
        hunk.className = "diff-row diff-hunk";
        hunk.textContent = row.left;
        surface.append(hunk);
        return;
      }
      const lineNode = document.createElement("div");
      lineNode.className = `diff-row diff-${row.type}`;
      const left = document.createElement("div");
      left.className = "diff-cell diff-left";
      left.textContent = row.left == null ? "" : row.left;
      const right = document.createElement("div");
      right.className = "diff-cell diff-right";
      right.textContent = row.right == null ? "" : row.right;
      lineNode.append(left, right);
      surface.append(lineNode);
    });
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "diff-row diff-hunk";
      empty.textContent = "选择文件后查看 diff。";
      surface.append(empty);
    }
    preview.replaceChildren(surface);
  }
  const metaNode = projectPreviewMeta();
  if (metaNode) {
    metaNode.textContent = meta || "";
  }
}

async function loadProjectTree(path = "") {
  const button = actionButtons.get("project-refresh");
  setBusy(button, true, "Loading");
  setWorkbenchMotionState("project", WORKBENCH_MOTION_STATES.project, true);
  try {
    let url = "/api/project/tree?depth=4&limit=400";
    if (path) {
      url += `&path=${encodeURIComponent(path)}`;
    }
    const response = await requestJson(url);
    projectTreeRoot = response.root;
    setText("project.path", response.workspace);
    renderProjectApiTree([response.root]);
    if (!selectedProjectPath) {
      updateProjectPreview(
        "从左侧目录树选择文件预览；快捷键：Ctrl+P 搜文件 · @ 搜符号 · :行号 跳转。",
        response.root?.name || "Project tree loaded.",
      );
    }
  } catch (error) {
    projectTreeRoot = null;
    renderProjectApiTree([]);
    updateProjectPreview(error.message, "Project tree failed.");
  } finally {
    setWorkbenchMotionState("project", WORKBENCH_MOTION_STATES.project, false);
    setBusy(button, false);
  }
}

function renderProjectApiTree(entries) {
  const list = projectTreeList();
  if (!list) {
    return;
  }
  list.replaceChildren();
  const nodes = entries || [];
  if (!nodes.length) {
    const item = document.createElement("li");
    item.className = "project-tree-empty";
    item.textContent = "Project tree is empty or unavailable.";
    list.append(item);
    return;
  }
  const currentRoot = nodes[0];
  if (currentRoot?.kind === "dir" && currentRoot.relative_path) {
    list.append(renderProjectParentNode(currentRoot.relative_path));
  }
  nodes.forEach((entry) => {
    list.append(renderProjectTreeNode(entry, 0));
  });
}

function projectParentPath(path = "") {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function renderProjectParentNode(currentPath) {
  const parentPath = projectParentPath(currentPath);
  const item = document.createElement("li");
  item.className = "project-tree-item";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-tree-node is-dir is-parent";
  button.dataset.projectPath = parentPath;
  button.dataset.projectKind = "dir";
  button.dataset.projectParent = "true";
  button.style.setProperty("--project-tree-depth", "0");

  const caret = document.createElement("span");
  caret.className = "project-tree-caret";
  const icon = document.createElement("img");
  icon.src = iconUrl("folder");
  icon.alt = "";
  const name = document.createElement("span");
  name.textContent = "返回上一级";
  const target = document.createElement("small");
  target.textContent = parentPath || "workspace root";
  button.append(caret, icon, name, target);
  item.append(button);
  return item;
}

function renderProjectTreeNode(entry, depth) {
  const item = document.createElement("li");
  item.className = "project-tree-item";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `project-tree-node is-${entry.kind || "file"}`;
  button.dataset.projectPath = entry.relative_path || "";
  button.dataset.projectKind = entry.kind || "file";
  button.dataset.fileExt = projectFileExtension(entry);
  const gitStatus = projectGitStatus(entry);
  if (gitStatus) {
    button.dataset.gitStatus = gitStatus;
  }
  button.style.setProperty("--project-tree-depth", String(depth));
  button.classList.toggle("is-active", Boolean(selectedProjectPath) && selectedProjectPath === entry.relative_path);
  // 阶段D：树节点可拖拽，dragstart 写入 text/coolzhu-path 供 diff 右半 dropzone 取用（plan §4.6）。
  button.draggable = true;
  button.addEventListener("dragstart", (event) => {
    const dragPath = entry.relative_path || "";
    if (!dragPath || (entry.kind || "file") !== "file") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/coolzhu-path", dragPath);
    event.dataTransfer.effectAllowed = "copy";
  });

  const children = Array.isArray(entry.children) ? entry.children : [];
  const caret = document.createElement("span");
  caret.className = "project-tree-caret";
  if (entry.kind === "dir" && children.length) {
    caret.classList.add("has-children");
  }
  const icon = document.createElement("img");
  icon.src = iconUrl(projectIconForEntry(entry));
  icon.alt = "";
  const name = document.createElement("span");
  name.textContent = entry.name || entry.relative_path || "(root)";
  button.append(caret, icon, name);
  if (entry.kind === "file" && Number.isFinite(entry.file_size)) {
    const size = document.createElement("small");
    size.textContent = formatFileSize(entry.file_size);
    button.append(size);
  }
  item.append(button);

  if (children.length) {
    const childList = document.createElement("ul");
    childList.className = "project-tree-children";
    const expanded = depth === 0 || expandedProjectPaths.has(entry.relative_path || "");
    childList.hidden = !expanded;
    item.classList.toggle("is-expanded", expanded);
    children.forEach((child) => childList.append(renderProjectTreeNode(child, depth + 1)));
    item.append(childList);
  }
  if (entry.omitted_count) {
    const omitted = document.createElement("div");
    omitted.className = "project-tree-omitted";
    omitted.textContent = `${entry.omitted_count} more item(s) omitted`;
    item.append(omitted);
  }
  return item;
}

function projectFileExtension(entry = {}) {
  if (entry.kind === "dir") {
    return "folder";
  }
  const name = String(entry.name || entry.relative_path || "");
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "file";
}

function projectIconForEntry(entry = {}) {
  if (entry.kind === "dir") {
    return "folder";
  }
  const ext = projectFileExtension(entry);
  if (["rs", "js", "ts", "tsx", "jsx", "py", "toml", "json", "md", "css", "html"].includes(ext)) {
    return "file-type";
  }
  return "file";
}

function projectGitStatus(entry = {}) {
  const raw = String(entry.git_status || entry.status || "").toLowerCase();
  if (["modified", "m", "changed"].includes(raw)) return "modified";
  if (["added", "a", "new"].includes(raw)) return "added";
  if (["deleted", "d", "removed"].includes(raw)) return "deleted";
  if (["untracked", "u", "unknown"].includes(raw)) return "untracked";
  return "";
}

let projectTreeClickTimer = null;

function toggleProjectTreeNode(node) {
  const item = node.closest(".project-tree-item");
  if (!item) {
    return;
  }
  const childList = item.querySelector(":scope > .project-tree-children");
  const expanded = !item.classList.contains("is-expanded");
  const path = node.dataset.projectPath || "";
  item.classList.toggle("is-expanded", expanded);
  if (childList) {
    childList.hidden = !expanded;
  }
  if (path) {
    if (expanded) {
      expandedProjectPaths.add(path);
    } else {
      expandedProjectPaths.delete(path);
    }
  }
  pulseWorkbenchMotionState("project", WORKBENCH_MOTION_STATES.project, 720);
}

function syncProjectTreeSelection() {
  const list = projectTreeList();
  if (!list) {
    return;
  }
  list.querySelectorAll(".project-tree-node").forEach((node) => {
    node.classList.toggle(
      "is-active",
      Boolean(selectedProjectPath) && node.dataset.projectPath === selectedProjectPath,
    );
  });
}

function onProjectTreeClick(event) {
  const node = event.target.closest("[data-project-path]");
  if (!node) {
    return;
  }
  const path = node.dataset.projectPath || "";
  const kind = node.dataset.projectKind || "file";
  if (kind !== "dir") {
    void openProjectFile(path);
    return;
  }
  // “返回上一级”：单击直接进入上级目录
  if (node.dataset.projectParent) {
    selectedProjectPath = "";
    void loadProjectTree(path);
    return;
  }
  // 目录：单击展开/折叠；延迟触发以便与双击（进入子目录）区分
  if (projectTreeClickTimer) {
    clearTimeout(projectTreeClickTimer);
  }
  projectTreeClickTimer = setTimeout(() => {
    projectTreeClickTimer = null;
    toggleProjectTreeNode(node);
  }, 220);
}

async function onProjectTreeDblClick(event) {
  const node = event.target.closest("[data-project-path]");
  if (!node) {
    return;
  }
  if ((node.dataset.projectKind || "file") !== "dir") {
    return;
  }
  // 取消待执行的单击（展开/折叠），改为进入子目录
  if (projectTreeClickTimer) {
    clearTimeout(projectTreeClickTimer);
    projectTreeClickTimer = null;
  }
  selectedProjectPath = "";
  await loadProjectTree(node.dataset.projectPath || "");
}

async function openProjectFile(path = selectedProjectPath) {
  if (!path) {
    updateProjectPreview("Select a file from the project tree first.", "No file selected.");
    return;
  }
  const previousPath = selectedProjectPath;
  selectedProjectPath = path;
  syncProjectTreeSelection();
  try {
    const meta = await requestJson(`/api/project/file/meta?path=${encodeURIComponent(path)}`);
    const metaText = `${meta.relative_path} · ${formatFileSize(meta.file_size)}${meta.binary ? " · binary" : ""}`;
    if (!meta.previewable) {
      updateProjectPreview("This file is binary or too large for inline preview.", metaText);
      return;
    }
    const response = await requestJson(`/api/project/file?path=${encodeURIComponent(path)}&offset=0&limit=65536`);
    const suffix = response.next_offset ? `\n\n[Preview truncated. Next offset: ${response.next_offset}]` : "";
    const content = `${response.content}${suffix}`;
    const lang = syntaxLangForPath(path);
    renderProjectContent(content, lang, metaText);
    // 阶段E：打开/激活对应 view tab 并缓存内容，切换回来时免重新拉取。
    openIdeViewTab(path, { payload: { content, lang, meta: metaText } });
  } catch (error) {
    selectedProjectPath = previousPath;
    syncProjectTreeSelection();
    updateProjectPreview(error.message, "File preview failed.");
  }
}

// === IDE 工程窗口 · 阶段D：View/Diff 合并按钮状态机（plan §4.6 / 规格5） ===
// view ⇄ diff 往复：进入 diff 以当前 view 文件为左、右默认同路径（self-diff 双栏同内容）；
// 右侧换文件两路：ide-diff-right 输入回车 / 从目录树拖文件到右半 dropzone。
function toggleIdeViewDiffMode() {
  if (ideViewDiffMode === "view") {
    void enterIdeDiffMode();
  } else {
    void exitIdeDiffMode();
  }
}

function updateIdeModeToggleButton() {
  const button = actionButtons.get("project-mode-toggle");
  const label = document.querySelector('[data-role="ide-mode-toggle-label"]');
  const icon = document.querySelector('[data-role="ide-mode-toggle-icon"]');
  const paths = document.querySelector('[data-role="ide-diff-paths"]');
  if (ideViewDiffMode === "diff") {
    button?.classList.add("is-active");
    if (label) label.textContent = "View";
    if (icon) icon.src = iconUrl("vision");
    if (paths) paths.hidden = false;
  } else {
    button?.classList.remove("is-active");
    if (label) label.textContent = "Diff";
    if (icon) icon.src = iconUrl("diff");
    if (paths) paths.hidden = true;
  }
}

async function enterIdeDiffMode() {
  const left = selectedProjectPath || ideDiffLeft || "";
  if (!left) {
    updateProjectPreview("先在目录树选择一个文件，再切换到 Diff。", "Diff 需要当前文件");
    return;
  }
  ideDiffLeft = left;
  ideDiffRight = left; // 默认 self-diff：左右同路径 → 双栏同内容
  ideViewDiffMode = "diff";
  updateIdeModeToggleButton();
  syncIdeDiffPathsUI();
  await loadIdeDiffFiles(ideDiffLeft, ideDiffRight);
}

async function exitIdeDiffMode() {
  ideViewDiffMode = "view";
  updateIdeModeToggleButton();
  // 回 view：重新打开左侧文件的普通视图。
  if (ideDiffLeft) {
    await openProjectFile(ideDiffLeft);
  } else if (selectedProjectPath) {
    await openProjectFile(selectedProjectPath);
  } else {
    updateProjectPreview("Select a file from the project tree to preview content.", "View");
  }
}

function syncIdeDiffPathsUI() {
  const leftLabel = document.querySelector('[data-role="ide-diff-left-label"]');
  const rightInput = document.querySelector('[data-role="ide-diff-right"]');
  if (leftLabel) {
    leftLabel.textContent = ideDiffLeft || "—";
  }
  if (rightInput) {
    rightInput.value = ideDiffRight || "";
  }
}

async function submitIdeDiffRightFromInput() {
  if (ideViewDiffMode !== "diff") {
    return;
  }
  const input = document.querySelector('[data-role="ide-diff-right"]');
  const value = (input?.value || "").trim();
  if (!value) {
    updateProjectPreview("右侧路径为空，请输入要对比的文件路径。", "Diff 右侧为空");
    return;
  }
  await applyIdeDiffRight(value);
}

async function applyIdeDiffRight(path) {
  if (ideViewDiffMode !== "diff") {
    return;
  }
  ideDiffRight = path;
  syncIdeDiffPathsUI();
  await loadIdeDiffFiles(ideDiffLeft, ideDiffRight);
}

// 调 /api/project/diff-files?left=&right= 取统一 diff；同文件(self-diff)时 diff 为空，
// 回退到双文件抓取 + diffAlignLines 渲染双栏同内容（plan §4.6 规格5）。
// === IDE 工程窗口 · 阶段E：多文件标签页 tab 管理（plan §4.7 / 规格6） ===
// view tab 显示文件名，diff tab 显示 左名⇄右名（同文件 self-diff 显示 文件名⇄自身）；
// 点击激活（按 tab.kind 切 mode 并渲染对应视图）、中键/×关闭、关闭激活 tab 后激活右邻；
// 上限 12 个 tab，超出关最旧未激活并提示一次；sessionStorage 持久（刷新存活、重启清空）。

function ideTabNewId() {
  return "ide-tab-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function ideBaseName(path) {
  if (!path) return "";
  const parts = String(path).replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(path);
}

function ideTabTitleOf(tab) {
  if (tab.kind === "diff") {
    const left = ideBaseName(tab.path);
    if (tab.right && tab.right !== tab.path) {
      return `${left} ⇄ ${ideBaseName(tab.right)}`;
    }
    return `${left} ⇄ 自身`;
  }
  return ideBaseName(tab.path);
}

function ideTabKey(tab) {
  return `${tab.kind}|${tab.path || ""}|${tab.right || ""}`;
}

function findIdeTabByKind(kind, path, right = "") {
  const key = `${kind}|${path || ""}|${right || ""}`;
  return ideState.tabs.find((tab) => ideTabKey(tab) === key) || null;
}

function persistIdeTabs() {
  try {
    const data = ideState.tabs.map((tab) => ({
      id: tab.id,
      kind: tab.kind,
      title: tab.title,
      path: tab.path,
      right: tab.right || "",
      active: tab.id === ideState.activeTabId,
    }));
    sessionStorage.setItem(
      IDE_TABS_STORAGE_KEY,
      JSON.stringify({ tabs: data, activeTabId: ideState.activeTabId }),
    );
  } catch (_e) {
    /* sessionStorage 不可用时静默降级（刷新存活即可，不入后端） */
  }
}

function restoreIdeTabsFromStorage() {
  try {
    const raw = sessionStorage.getItem(IDE_TABS_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.tabs)) return;
    ideState.tabs = data.tabs
      .filter((tab) => tab && (tab.kind === "view" || tab.kind === "diff") && tab.path)
      .map((tab) => ({
        id: tab.id || ideTabNewId(),
        kind: tab.kind,
        title: tab.title || ideTabTitleOf(tab),
        path: tab.path,
        right: tab.right || "",
        active: false,
        payload: null,
      }));
    ideState.activeTabId =
      data.activeTabId && ideState.tabs.some((tab) => tab.id === data.activeTabId)
        ? data.activeTabId
        : (ideState.tabs[0] ? ideState.tabs[0].id : null);
  } catch (_e) {
    ideState.tabs = [];
    ideState.activeTabId = null;
  }
}

function showIdeTabEvictNotice() {
  // 上限超出关最旧未激活 tab，提示一次。
  const notice = document.createElement("div");
  notice.className = "ide-tab-evict-toast";
  notice.textContent = `标签已达上限 ${IDE_TAB_MAX}，已关闭最旧的未激活标签。`;
  document.body.append(notice);
  window.setTimeout(() => notice.remove(), 2600);
}

function evictOldestInactiveIdeTab() {
  if (ideState.tabs.length <= IDE_TAB_MAX) {
    return false;
  }
  const idx = ideState.tabs.findIndex((tab) => tab.id !== ideState.activeTabId);
  if (idx < 0) {
    return false;
  }
  ideState.tabs.splice(idx, 1);
  return true;
}

function renderIdeTabbar() {
  const bar = document.querySelector('[data-role="ide-tabbar"]');
  if (!bar) {
    return;
  }
  bar.replaceChildren();
  if (!ideState.tabs.length) {
    bar.classList.add("is-empty");
    return;
  }
  bar.classList.remove("is-empty");
  ideState.tabs.forEach((tab) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ide-tab" + (tab.id === ideState.activeTabId ? " is-active" : "");
    el.dataset.tabId = tab.id;
    el.title =
      tab.kind === "diff"
        ? `Diff: ${tab.path} ⇄ ${tab.right || tab.path}`
        : tab.path;
    const label = document.createElement("span");
    label.className = "ide-tab-label";
    label.textContent = tab.title;
    const close = document.createElement("span");
    close.className = "ide-tab-close";
    close.textContent = "×";
    close.title = "关闭标签";
    el.append(label, close);
    el.addEventListener("click", (event) => {
      if (event.target === close || close.contains(event.target)) {
        event.stopPropagation();
        closeIdeTab(tab.id);
        return;
      }
      activateIdeTab(tab.id);
    });
    el.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        // 中键关闭
        event.preventDefault();
        closeIdeTab(tab.id);
      }
    });
    el.addEventListener("mousedown", (event) => {
      if (event.button === 1) {
        event.preventDefault();
      }
    });
    bar.append(el);
  });
}

function setIdeActiveTab(id, { skipRender = false } = {}) {
  ideState.tabs.forEach((tab) => {
    tab.active = tab.id === id;
  });
  ideState.activeTabId = id;
  const active = ideState.tabs.find((tab) => tab.id === id) || null;
  // 全局 mode 跟随激活 tab 的 kind（plan §4.7）。
  ideViewDiffMode = active ? active.kind : "view";
  updateIdeModeToggleButton();
  persistIdeTabs();
  if (!skipRender) {
    renderIdeTabbar();
  }
}

function openIdeViewTab(path, { payload = null } = {}) {
  if (!path) {
    return null;
  }
  let tab = findIdeTabByKind("view", path, "");
  if (!tab) {
    tab = {
      id: ideTabNewId(),
      kind: "view",
      path,
      right: "",
      title: ideBaseName(path),
      active: false,
      payload: null,
    };
    ideState.tabs.push(tab);
    if (evictOldestInactiveIdeTab()) {
      showIdeTabEvictNotice();
    }
  }
  if (payload) {
    tab.payload = payload;
  }
  setIdeActiveTab(tab.id);
  return tab;
}

function openIdeDiffTab(left, right, { payload = null, updateInPlace = false } = {}) {
  const rightPath = right || left || "";
  const title = ideTabTitleOf({ kind: "diff", path: left, right: rightPath });
  let tab = null;
  if (updateInPlace && ideState.activeTabId) {
    const active = ideState.tabs.find((t) => t.id === ideState.activeTabId);
    if (active && active.kind === "diff") {
      // 当前激活的就是 diff tab：原地更新右栏（plan §4.6 右输入换文件）。
      active.path = left;
      active.right = rightPath;
      active.title = title;
      tab = active;
    }
  }
  if (!tab) {
    tab = findIdeTabByKind("diff", left, rightPath);
    if (!tab) {
      tab = {
        id: ideTabNewId(),
        kind: "diff",
        path: left,
        right: rightPath,
        title,
        active: false,
        payload: null,
      };
      ideState.tabs.push(tab);
      if (evictOldestInactiveIdeTab()) {
        showIdeTabEvictNotice();
      }
    } else {
      tab.title = title;
    }
  }
  if (payload) {
    tab.payload = payload;
  }
  setIdeActiveTab(tab.id);
  return tab;
}

function renderIdeTabContent(tab) {
  if (!tab) {
    return;
  }
  if (tab.kind === "diff") {
    if (tab.payload && Array.isArray(tab.payload.rows)) {
      renderProjectDiffView(tab.payload.rows, tab.payload.meta || "");
    } else {
      void loadIdeDiffFiles(tab.path, tab.right || tab.path);
    }
  } else {
    if (tab.payload && tab.payload.content != null) {
      renderProjectContent(
        tab.payload.content,
        tab.payload.lang || syntaxLangForPath(tab.path),
        tab.payload.meta || "",
      );
    } else {
      void openProjectFile(tab.path);
    }
  }
}

function activateIdeTab(id) {
  const tab = ideState.tabs.find((t) => t.id === id);
  if (!tab) {
    return;
  }
  setIdeActiveTab(id);
  // 按 tab.kind 切 mode 并同步关联状态，再渲染对应视图。
  if (tab.kind === "diff") {
    ideDiffLeft = tab.path;
    ideDiffRight = tab.right || tab.path;
    syncIdeDiffPathsUI();
    selectedProjectPath = tab.path;
  } else {
    selectedProjectPath = tab.path;
    syncProjectTreeSelection();
  }
  renderIdeTabContent(tab);
}

function closeIdeTab(id) {
  const idx = ideState.tabs.findIndex((tab) => tab.id === id);
  if (idx < 0) {
    return;
  }
  const wasActive = ideState.tabs[idx].id === ideState.activeTabId;
  ideState.tabs.splice(idx, 1);
  if (wasActive) {
    // 关闭激活 tab 后激活右邻（无右邻则左邻）。
    const next = ideState.tabs[idx] || ideState.tabs[idx - 1] || null;
    if (next) {
      activateIdeTab(next.id);
    } else {
      ideState.activeTabId = null;
      ideViewDiffMode = "view";
      updateIdeModeToggleButton();
      persistIdeTabs();
      renderIdeTabbar();
      updateProjectPreview(
        "Select a file from the project tree to preview content.",
        "View",
      );
    }
  } else {
    persistIdeTabs();
    renderIdeTabbar();
  }
}

// 刷新还原：恢复 tabbar 并激活上次激活的 tab（无 payload，按需重新拉取内容）。
function restoreIdeTabsOnInit() {
  restoreIdeTabsFromStorage();
  renderIdeTabbar();
  if (!ideState.activeTabId) {
    return;
  }
  const tab = ideState.tabs.find((t) => t.id === ideState.activeTabId);
  if (!tab) {
    return;
  }
  if (tab.kind === "diff") {
    ideDiffLeft = tab.path;
    ideDiffRight = tab.right || tab.path;
    syncIdeDiffPathsUI();
  } else {
    selectedProjectPath = tab.path;
    syncProjectTreeSelection();
  }
  renderIdeTabContent(tab);
}

async function loadIdeDiffFiles(left, right) {
  if (!left || !right) {
    updateProjectPreview("Enter two file paths to compare.", "Diff files");
    return;
  }
  try {
    const diffResp = await requestJson(
      `/api/project/diff-files?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`,
    );
    let rows = parseUnifiedDiffRows(diffResp.diff || "");
    let metaText = `Diff: ${diffResp.left || left} ↔ ${diffResp.right || right}`;
    if (diffResp.truncated) {
      metaText += " · truncated";
    }
    if (!rows.length) {
      // 同文件 / 内容一致：双栏完整显示文件内容（而非“无差异”占位）。
      const [leftFile, rightFile] = await Promise.all([
        requestJson(`/api/project/file?path=${encodeURIComponent(left)}&offset=0&limit=65536`),
        requestJson(`/api/project/file?path=${encodeURIComponent(right)}&offset=0&limit=65536`),
      ]);
      rows = diffAlignLines(
        (leftFile.content || "").split("\n"),
        (rightFile.content || "").split("\n"),
      );
      const identical = rows.every((row) => row.type === "same");
      if (identical) {
        metaText += " · 内容一致";
      }
    }
    renderProjectDiffView(rows, metaText);
    // 阶段E：打开/激活 diff tab 并缓存 rows，切换回来时免重新拉取（右栏换文件时原地更新）。
    openIdeDiffTab(left, right, { payload: { rows, meta: metaText }, updateInPlace: true });
  } catch (error) {
    updateProjectPreview(error.message, "Diff files failed.");
  }
}

function initializeWorkbenchWindows() {
  const workbench = document.querySelector('[data-role="workbench"]');
  if (!workbench) {
    return;
  }
  initProjectSplitter();
  initIdeOmniSearch();
  restoreIdeTabsOnInit();
  const shell = document.querySelector(".ui-redesign");
  const tabs = Array.from(document.querySelectorAll("[data-window-target]"));
  const windows = Array.from(document.querySelectorAll("[data-window-id]"));
  const sideTitles = Array.from(document.querySelectorAll("[data-window-toggle]"));
  const requestedWindow = new URLSearchParams(location.search).get("window");
  const requestedFocus = new URLSearchParams(location.search).get("focus");
  const validWindows = new Set(windows.map((windowNode) => windowNode.dataset.windowId).filter(Boolean));
  let activeWindow = validWindows.has(requestedWindow) ? requestedWindow : workbench.dataset.activeWindow || "chat";

  const setActiveWindow = (nextWindow) => {
    activeWindow = nextWindow || "";
    workbench.dataset.activeWindow = activeWindow;
    const folded = !activeWindow;
    workbench.classList.toggle("is-folded", folded);
    shell?.classList.toggle("all-windows-folded", folded);
    tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.windowTarget === activeWindow);
    });
    windows.forEach((windowNode) => {
      windowNode.classList.toggle("is-active", windowNode.dataset.windowId === activeWindow);
    });
    if (folded) {
      loadOfficeScene({ silent: true });
    }
    requestBridgeVisualEffectsResize();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveWindow(tab.dataset.windowTarget);
    });
    tab.addEventListener("dblclick", () => {
      setActiveWindow(tab.dataset.windowTarget);
    });
  });

  sideTitles.forEach((title) => {
    title.addEventListener("dblclick", () => {
      setActiveWindow(title.dataset.windowToggle === activeWindow ? "" : title.dataset.windowToggle);
    });
  });

  setActiveWindow(activeWindow);
  if (requestedFocus) {
    window.setTimeout(() => {
      const focusRole = String(requestedFocus).replace(/["\\]/g, "");
      document.querySelector(`[data-role="${focusRole}"]`)?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 250);
  }
}

function attachmentsFromText(text) {
  const forcedImageUrls = new Set(
    Array.from(String(text || "").matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g))
      .map((match) => cleanupUrl(match[1])),
  );
  return extractUrls(text).flatMap((url) => {
    const parsed = safeUrl(url);
    const pathname = parsed?.pathname?.toLowerCase() ?? url.toLowerCase();
    const name = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || parsed?.hostname || "链接");
    const kind = attachmentKindForUrl(url, { forceImage: forcedImageUrls.has(url) });
    if (!kind) {
      return [];
    }
    if (kind === "image") {
      return { kind: "image", name, url, mime_type: mimeForExtension(pathname) };
    }
    if (kind === "video") {
      return { kind: "video", name, url, mime_type: mimeForExtension(pathname) };
    }
    if (kind === "audio") {
      return { kind: "audio", name, url, mime_type: mimeForExtension(pathname) };
    }
    if (kind === "document") {
      return { kind: "document", name, url, mime_type: mimeForExtension(pathname) };
    }
    return [];
  });
}

function demoAttachmentsFromText(text) {
  return attachmentsFromText(text);
}

function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s<>"']+/g) || [];
  return Array.from(new Set(matches.map(cleanupUrl)));
}

function cleanupUrl(url) {
  return String(url || "").replace(/[),.;，。；）]+$/u, "");
}

function safeUrl(value) {
  try {
    return new URL(value, location.origin);
  } catch {
    return null;
  }
}

function mimeForExtension(pathname) {
  const ext = pathname.split(".").pop()?.split("?")[0] ?? "";
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    ogv: "video/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
    opus: "audio/opus",
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    log: "text/plain",
    json: "application/json",
  };
  return map[ext] || null;
}

function hasHeader(headers, name) {
  if (!headers) return false;
  const target = String(name).toLowerCase();
  if (headers instanceof Headers) {
    return headers.has(name);
  }
  if (Array.isArray(headers)) {
    return headers.some(([key]) => String(key).toLowerCase() === target);
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

function withDefaultJsonHeaders(init = {}) {
  const next = { ...init };
  const body = next.body;
  const shouldSetJson =
    body != null
    && typeof body === "string"
    && !hasHeader(next.headers, "content-type");
  if (!shouldSetJson) {
    return next;
  }
  next.headers = {
    ...(next.headers || {}),
    "Content-Type": "application/json",
  };
  return next;
}

function safeErrorBody(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 240)}…` : normalized;
}

async function requestJson(url, init) {
  const response = await fetch(url, withDefaultJsonHeaders(init));
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { error: safeErrorBody(text), parse_error: error.message };
    }
  }
  if (!response.ok) {
    const detail = data.error || data.message || safeErrorBody(text) || response.statusText;
    const error = new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`);
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = data;
    throw error;
  }
  return data;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setText(key, value) {
  const node = bindings.get(key);
  if (!node) {
    return;
  }
  if (key === "vision.path") {
    node.title = value;
  }
  node.textContent = value;
}

function setVisionPreview(capture) {
  const node = bindings.get("vision.path");
  if (!node) {
    return;
  }
  const overlay = visionWindowEnsureRealtimeOverlay(node);
  const exists = Boolean(capture?.exists);
  const path = capture?.path || "";
  const url = capture?.preview_url || "/api/capture/latest/image";
  node.title = exists ? path : "等待采集";
  node.classList.toggle("is-empty", !exists);
  if (exists) {
    node.style.backgroundImage = `linear-gradient(180deg, rgba(7, 17, 25, 0.08), rgba(7, 17, 25, 0.18)), url("${url}?t=${capture.modified_at || Date.now()}")`;
    node.replaceChildren(overlay);
  } else {
    node.style.backgroundImage = "";
    overlay.replaceChildren();
    const empty = document.createElement("span");
    empty.textContent = "等待采集";
    node.replaceChildren(empty, overlay);
  }
}

const WORKBENCH_MOTION_STATES = Object.freeze({
  project: "mapping",
  settings: "engine-save",
  clawbot: "linked",
  chat: "transmitting",
  browser: "observing",
  terminal: "reactor-run",
  tasks: "unlocked",
  memory: "crystal-rise",
  vision: "scanning",
});

const windowMotionTimers = new Map();

function setWorkbenchMotionState(windowId, state, active = true) {
  if (!windowId || !state) {
    return;
  }
  const windowNode = document.querySelector(`.workbench-window[data-window-id="${CSS.escape(windowId)}"]`);
  if (!windowNode) {
    return;
  }
  const timer = windowMotionTimers.get(windowId);
  if (timer) {
    window.clearTimeout(timer);
    windowMotionTimers.delete(windowId);
  }
  if (active) {
    windowNode.dataset.motionState = state;
  } else if (windowNode.dataset.motionState === state) {
    delete windowNode.dataset.motionState;
  }
}

function pulseWorkbenchMotionState(windowId, state, durationMs = 900) {
  setWorkbenchMotionState(windowId, state, true);
  const duration = Math.max(0, Number(durationMs) || 0);
  const timer = window.setTimeout(() => {
    const windowNode = document.querySelector(`.workbench-window[data-window-id="${CSS.escape(windowId)}"]`);
    if (windowNode?.dataset.motionState === state) {
      delete windowNode.dataset.motionState;
    }
    windowMotionTimers.delete(windowId);
  }, duration);
  windowMotionTimers.set(windowId, timer);
}

function setBusy(button, busy, label) {
  if (!button) {
    return;
  }
  if (!button.dataset.label) {
    button.dataset.label = button.textContent.trim();
  }
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);
  const textNode = Array.from(button.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
  );
  if (textNode) {
    textNode.textContent = busy ? label : button.dataset.label;
  } else {
    button.append(document.createTextNode(busy ? label : button.dataset.label));
  }
}

function setSendButtonRunning(running) {
  setWorkbenchMotionState("chat", WORKBENCH_MOTION_STATES.chat, running);
  const button = actionButtons.get("send-message");
  if (!button) {
    return;
  }
  if (!button.dataset.label) {
    button.dataset.label = button.textContent.trim() || "发送";
  }
  button.disabled = false;
  button.classList.toggle("is-busy", running);
  button.textContent = running ? "停止" : button.dataset.label;
  button.title = running ? "停止模型思考和回复" : "";
}

// 异步视频：pending 消息按内嵌 task_id 轮询 /api/videos/{task_id}，完成后把消息替换为视频。
const videoPollingTasks = new Set();
function scheduleVideoPolling(messageId) {
  if (!messageId || videoPollingTasks.has(messageId)) return;
  videoPollingTasks.add(messageId);
  const startedAt = Date.now();
  let attempts = 0;
  const maxAttempts = 260; // 260 × 5s ≈ 21 分钟，略大于后端轮询上限
  const stop = (timer) => {
    clearInterval(timer);
    videoPollingTasks.delete(messageId);
  };
  const tick = async (timer) => {
    attempts += 1;
    if (attempts > maxAttempts) {
      stop(timer);
      videoRuntimeTasks.delete(messageId);
      refreshVideoTaskCard();
      return;
    }
    let data;
    try {
      const resp = await fetch(`/api/videos/${encodeURIComponent(messageId)}`);
      if (!resp.ok) return;
      data = await resp.json();
    } catch {
      return;
    }
    if (!data) return;
    // 遗留中断任务：job 已丢失（app 重启）→ 停止轮询、移出任务卡片、消息不再停留"生成中"。
    if (data.status === "unknown") {
      stop(timer);
      videoRuntimeTasks.delete(messageId);
      refreshVideoTaskCard();
      const article = chatMessageList()?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
      const contentEl = article?.querySelector('[data-role="message-content"]');
      if (contentEl && /生成中/.test(contentEl.textContent || "")) {
        renderRichText(contentEl, "（视频生成任务已中断，请重新发起）");
      }
      return;
    }
    // 更新任务卡片：视频任务进度 + 等待时长（用后端 created_at 折算，跨刷新仍准确）。
    const elapsedStart = Number(data.elapsed_ms) > 0 ? Date.now() - Number(data.elapsed_ms) : startedAt;
    const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
    const cardStatus = data.status === "completed" ? "完成" : (data.status === "failed" ? "失败" : "运行中");
    videoRuntimeTasks.set(messageId, {
      id: `video-${messageId}`,
      owner_agent: "视频生成",
      executor_agent: "视频生成",
      status: cardStatus,
      summary: data.status === "failed"
        ? `视频生成失败：${compactGoalText(data.error || "未知错误", 40)}`
        : (data.status === "completed" ? "视频生成完成" : `视频生成中 ${progress}%`),
      startedAt: elapsedStart,
      timeout_ms: 0,
    });
    refreshVideoTaskCard();
    if (data.status === "completed" && data.url) {
      stop(timer);
      applyVideoToMessage(messageId, data.url);
      // 完成态短暂保留后从任务卡片移除（不遗留）。
      window.setTimeout(() => { videoRuntimeTasks.delete(messageId); refreshVideoTaskCard(); }, 4000);
    } else if (data.status === "failed") {
      stop(timer);
      const article = chatMessageList()?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
      const contentEl = article?.querySelector('[data-role="message-content"]');
      if (contentEl) renderRichText(contentEl, `视频生成失败：${data.error || "未知错误"}`);
      window.setTimeout(() => { videoRuntimeTasks.delete(messageId); refreshVideoTaskCard(); }, 6000);
    }
  };
  const timer = setInterval(() => tick(timer), 5000);
  tick(timer); // 立即第一次轮询，不等首个 5s
}

function applyVideoToMessage(messageId, url) {
  const list = chatMessageList();
  const article = list?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!article) return;
  const contentEl = article.querySelector('[data-role="message-content"]');
  if (contentEl) renderRichText(contentEl, "已根据提示生成视频。");
  renderAttachments(article.querySelector(".attachments"), [
    { kind: "video", name: "agnes-video.mp4", url, mime_type: "video/mp4" },
  ]);
  if (list) list.scrollTop = list.scrollHeight;
}

function upsertMessage(message, { streaming = false, sessionId = activeSessionId } = {}) {
  const list = chatMessageList();
  if (!list) {
    return null;
  }
  const messageId = message.id ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (message.kind === "assistant-video-pending") {
    scheduleVideoPolling(messageId);
  }
  const existing = list.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (existing) {
    existing.className = `message ${kindForMessage(message)}`;
    existing.classList.toggle("is-streaming", streaming);
    existing.dataset.messageKind = message.kind || "";
    const portrait = existing.querySelector(".portrait");
    if (portrait) {
      const avatarPath = avatarForAuthor(message.author);
      portrait.src = avatarPath ? avatarUrl(avatarPath) : defaultIconUrlForMessage(message);
      existing.classList.toggle("has-session-avatar", Boolean(avatarPath));
      if (avatarPath) {
        existing.style.setProperty("--message-theme", avatarThemeForPath(avatarPath));
      } else {
        existing.style.removeProperty("--message-theme");
      }
    }
    existing.querySelector("strong").textContent = message.author;
    const content = existing.querySelector('[data-role="message-content"]') || existing.querySelector("p");
    if (content) {
      renderRichText(content, message.content || "");
    }
    renderAttachments(existing.querySelector(".attachments"), message.attachments || []);
    list.scrollTop = list.scrollHeight;
    return existing;
  }
  return addMessage({
    id: messageId,
    author: message.author,
    text: message.content || "",
    kind: kindForMessage(message),
    icon: iconForMessage(message),
    attachments: message.attachments || [],
    sessionId,
    streaming,
  });
}

function appendMessageText(id, delta) {
  const list = chatMessageList();
  const article = list?.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
  const content = article?.querySelector('[data-role="message-content"]') || article?.querySelector("p");
  if (!content) {
    return;
  }
  const nextText = `${content.dataset.rawText || content.textContent || ""}${delta}`;
  renderRichText(content, nextText);
  article.classList.add("is-streaming");
  list.scrollTop = list.scrollHeight;
}

function addMessage({ id, author, text, kind, icon, attachments = [], createdAt = null, prepend = false, sessionId = null, streaming = false, goalId = null, goalTransient = false }) {
  const list = chatMessageList();
  if (!list) {
    return;
  }
  const messageId = id ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (list.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)) {
    return list.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  }
  const article = document.createElement("article");
  article.className = `message ${kind}`;
  article.dataset.messageId = messageId;
  article.dataset.messageKind = kind;
  article.classList.toggle("is-streaming", streaming);
  const avatarPath = avatarForAuthor(author);
  article.classList.toggle("has-session-avatar", Boolean(avatarPath));
  if (avatarPath) {
    article.style.setProperty("--message-theme", avatarThemeForPath(avatarPath));
  }
  if (sessionId) {
    article.dataset.sessionId = sessionId;
  }
  if (goalId) {
    article.dataset.goalId = goalId;
    article.dataset.goalTransient = goalTransient ? "true" : "false";
  }
  article.innerHTML = `
    <img class="portrait" src="${avatarPath ? avatarUrl(avatarPath) : defaultIconUrlForIcon(icon)}" alt="" />
    <div>
      <strong></strong>
      <div class="message-content" data-role="message-content"></div>
      <div class="attachments"></div>
    </div>
    <time>${new Date(createdAt || Date.now()).toLocaleTimeString("zh-CN", { hour12: false })}</time>
  `;
  article.querySelector("strong").textContent = author;
  renderRichText(article.querySelector('[data-role="message-content"]'), text);
  renderAttachments(article.querySelector(".attachments"), attachments);
  if (prepend) {
    list.prepend(article);
  } else {
    list.append(article);
    list.scrollTop = list.scrollHeight;
  }
  return article;
}

function renderRichText(container, text = "") {
  if (!container) {
    return;
  }
  container.dataset.rawText = text;
  container.replaceChildren(...richTextNodes(text));
}

function richTextNodes(text) {
  const fragment = document.createDocumentFragment();
  const lines = String(text || "").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement("br"));
    }
    appendInlineRichText(fragment, line);
  });
  return Array.from(fragment.childNodes);
}

function appendInlineRichText(parent, text) {
  const pattern = /(!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>"')]+)|(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      parent.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    if (match[1]) {
      const isImage = match[1].startsWith("!");
      const label = match[2];
      const url = cleanupUrl(match[3]);
      const attachmentKind = attachmentKindForUrl(url, { forceImage: isImage });
      if (attachmentKind) {
        appendRichMedia(parent, url, label || url, attachmentKind);
      } else {
        parent.append(richLinkNode(url, label || url));
      }
    } else if (match[4]) {
      const url = cleanupUrl(match[4]);
      const attachmentKind = attachmentKindForUrl(url);
      if (attachmentKind) {
        appendRichMedia(parent, url, url, attachmentKind);
      } else {
        parent.append(richLinkNode(url, url));
      }
    } else if (match[5]) {
      const code = document.createElement("code");
      code.textContent = match[5].slice(1, -1);
      parent.append(code);
    } else if (match[6]) {
      const strong = document.createElement("strong");
      strong.textContent = match[6].slice(2, -2);
      parent.append(strong);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parent.append(document.createTextNode(text.slice(lastIndex)));
  }
}

function appendRichMedia(parent, url, label, kind) {
  if (kind === "audio") {
    parent.append(richAudioNode(url, label));
    return;
  }
  // 图片/视频也内联渲染（与附件区 renderAttachments 同款），仅对 http/https/blob/file 安全协议。
  const parsed = safeUrl(url);
  const canInline = parsed && ["http:", "https:", "blob:", "file:"].includes(parsed.protocol);
  if (canInline && kind === "image") {
    parent.append(richImageNode(url, label));
    return;
  }
  if (canInline && kind === "video") {
    parent.append(richVideoNode(url, label));
    return;
  }
  const link = richLinkNode(url, label || url);
  link.classList.add("rich-media-link", `is-${kind}`);
  parent.append(link);
}

function richAudioNode(url, label) {
  const frame = document.createElement("span");
  frame.className = "rich-media-frame is-audio";
  const audio = document.createElement("audio");
  audio.className = "rich-media-control";
  audio.src = url;
  audio.controls = true;
  audio.preload = "metadata";
  frame.append(audio, richLinkNode(url, label || "打开音频"));
  return frame;
}

function richImageNode(url, label) {
  const frame = document.createElement("span");
  frame.className = "rich-media-frame is-image";
  const image = document.createElement("img");
  image.className = "rich-media-control";
  image.src = url;
  image.alt = label || "图片";
  image.loading = "lazy";
  const link = richLinkNode(url, label || "打开图片");
  // 图片加载失败时回退为纯链接，避免破图。
  image.addEventListener("error", () => {
    frame.classList.add("is-failed");
    image.remove();
  });
  frame.append(image, link);
  return frame;
}

function richVideoNode(url, label) {
  const frame = document.createElement("span");
  frame.className = "rich-media-frame is-video";
  const video = document.createElement("video");
  video.className = "rich-media-control";
  video.src = url;
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata"; // 仅取元数据，不自动下载全片，也不自动播放
  frame.append(video, richLinkNode(url, label || "打开视频"));
  return frame;
}

function richLinkNode(url, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = label;
  return link;
}

function renderAttachments(container, attachments = []) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  attachments.forEach((attachment) => {
    const url = attachment.url || "";
    const kind = attachmentKindForAttachment(attachment);
    const parsed = safeUrl(url);
    const canPreviewUrl = parsed && ["http:", "https:", "blob:", "file:", "data:"].includes(parsed.protocol);
    if (canPreviewUrl && kind === "audio") {
      const frame = document.createElement("span");
      frame.className = "attachment-media-frame";
      const audio = document.createElement("audio");
      audio.className = "attachment-preview";
      audio.src = url;
      audio.controls = true;
      audio.preload = "metadata";
      frame.append(audio, attachmentLink(attachment, "打开音频"));
      container.append(frame);
      return;
    }
    if (canPreviewUrl && kind === "image") {
      const frame = document.createElement("span");
      frame.className = "attachment-media-frame";
      const link = attachmentLink(attachment, "打开图片");
      const image = document.createElement("img");
      image.className = "attachment-preview";
      image.src = url;
      image.alt = attachment.name || "图片附件";
      image.loading = "lazy";
      image.addEventListener("error", () => {
        frame.classList.add("is-failed");
        image.remove();
      });
      frame.append(image, link);
      container.append(frame);
      return;
    }
    if (canPreviewUrl && kind === "video") {
      const frame = document.createElement("span");
      frame.className = "attachment-media-frame";
      const video = document.createElement("video");
      video.className = "attachment-preview";
      video.src = url;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      frame.append(video, attachmentLink(attachment, "打开视频"));
      container.append(frame);
      return;
    }
    container.append(attachmentLink(attachment, attachment.kind || "链接"));
  });
}

function attachmentKindForAttachment(attachment) {
  const mime = String(attachment?.mime_type || attachment?.mime || attachment?.content_type || "").toLowerCase();
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  return attachment?.kind || attachmentKindForUrl(attachment?.url || "");
}

function attachmentIconForKind(kind) {
  if (kind === "audio") {
    return iconUrl("media-audio-wave");
  }
  if (kind === "video") {
    return iconUrl("media-video-film");
  }
  if (kind === "image") {
    return iconUrl("image-preview");
  }
  return iconUrl("file");
}

function isImageUrl(url) {
  const parsed = safeUrl(url || "");
  const path = parsed?.pathname?.toLowerCase() || String(url || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i.test(url || "")
    || /\/image\/(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)
    || /[?&](format|type)=(png|jpe?g|gif|webp|bmp|svg)(?:&|$)/i.test(url || "");
}

function isVideoUrl(url) {
  const parsed = safeUrl(url || "");
  const path = parsed?.pathname?.toLowerCase() || String(url || "").toLowerCase();
  return /\.(mp4|mov|m4v|ogv)(?:[?#].*)?$/i.test(url || "")
    || /\/video\/(mp4|webm|mov|m4v|ogv)$/i.test(path)
    || /[?&](format|type)=(mp4|mov|m4v|ogv)(?:&|$)/i.test(url || "");
}

function isAudioUrl(url) {
  const parsed = safeUrl(url || "");
  const path = parsed?.pathname?.toLowerCase() || String(url || "").toLowerCase();
  return /\.(mp3|wav|ogg|oga|webm|m4a|flac|aac|opus)(?:[?#].*)?$/i.test(url || "")
    || /\/audio\/(mpeg|mp3|wav|ogg|oga|webm|mp4|m4a|flac|aac|opus)$/i.test(path)
    || /[?&](format|type)=(mp3|wav|ogg|oga|webm|m4a|flac|aac|opus)(?:&|$)/i.test(url || "");
}

function isDocumentUrl(url) {
  return /\.(md|markdown|txt|log|json|pdf|docx?|xlsx?|pptx?)(?:[?#].*)?$/i.test(url || "");
}

function attachmentKindForUrl(url, { forceImage = false } = {}) {
  if (forceImage || isImageUrl(url)) {
    return "image";
  }
  if (isVideoUrl(url)) {
    return "video";
  }
  if (isAudioUrl(url)) {
    return "audio";
  }
  if (isDocumentUrl(url)) {
    return "document";
  }
  return null;
}

function mediaKindForUrl(url) {
  if (isImageUrl(url)) {
    return "image";
  }
  if (isVideoUrl(url)) {
    return "video";
  }
  if (isAudioUrl(url)) {
    return "audio";
  }
  return null;
}

function interactiveMessageSelector() {
  return [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "video",
    "audio",
    ".attachment-chip",
    ".attachment-preview",
    ".rich-media",
  ].join(",");
}

function attachmentLink(attachment, label) {
  const link = document.createElement("a");
  const parsed = safeUrl(attachment.url || "");
  if (parsed && ["http:", "https:", "blob:", "file:"].includes(parsed.protocol)) {
    link.href = attachment.url;
  } else {
    link.href = "#";
    link.style.textDecoration = "line-through";
  }
  link.className = "attachment-chip";
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = `${label}: ${attachment.name || parsed?.hostname || "附件"}`;
  return link;
}

async function refreshRealtimeSessionStatus() {
  try {
    const status = await requestJson("/api/realtime/session/status");
    realtimeSessionStatus = status;
    realtimeSessionRunning = Boolean(status.running);
    renderRealtimeSessionStatus(status);
    syncRealtimeSessionTask(status);
    setRealtimeSessionButtons(realtimeSessionRunning);
  } catch (error) {
    const node = document.querySelector('[data-role="realtime-session-status"]');
    if (node) {
      node.textContent = `实时交互状态不可用: ${error.message}`;
    }
    setRealtimeSessionButtons(false);
  }
}

function realtimeBargeInPolicyPayload() {
  return {
    enabled: true,
    browser_echo_cancellation: true,
    noise_suppression: true,
    auto_gain_control: true,
  };
}

async function realtimeSessionStart() {
  const button = actionButtons.get("realtime-session-start");
  setBusy(button, true, "启动中");
  audioRealtimeResumeAfterTts = false;
  try {
    const status = await requestJson("/api/realtime/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_vision: true,
        start_audio: true,
        requested_mode: "full_streaming",
        auto_send_transcript: true,
        auto_tts_reply: true,
        barge_in_policy: realtimeBargeInPolicyPayload(),
      }),
    });
    realtimeSessionStatus = status;
    realtimeSessionRunning = true;
    renderRealtimeSessionStatus(status);
    syncRealtimeSessionTask(status);

    try {
      await audioRealtimeStart({ backendStarted: true, status });
    } catch (error) {
      console.warn("实时语音启动失败:", error);
    }
    await refreshRealtimeSessionStatus();
    await refreshAudioStatus();
  } catch (error) {
    const node = document.querySelector('[data-role="realtime-session-status"]');
    if (node) {
      node.textContent = `实时交互启动失败: ${error.message}`;
    }
  } finally {
    setBusy(button, false);
    setRealtimeSessionButtons(realtimeSessionRunning);
  }
}

async function realtimeSessionStop() {
  const button = actionButtons.get("realtime-session-stop");
  setBusy(button, true, "停止中");
  audioRealtimeResumeAfterTts = false;
  audioRealtimeAwaitingReplyTts = false;
  stopActiveTtsPlayback("realtime-session-stop");
  try {
    if (sttRecorder && sttRecorder.state !== "inactive") {
      await sttStopDictation();
    }
    stopAudioRealtimePartialRecognition();
    const status = await requestJson("/api/realtime/session/stop", { method: "POST" });
    realtimeSessionStatus = status;
    realtimeSessionRunning = false;
    audioRealtimeRunning = false;
    renderRealtimeSessionStatus(status);
    syncRealtimeSessionTask(status);
    await refreshAudioStatus();
  } catch (error) {
    const node = document.querySelector('[data-role="realtime-session-status"]');
    if (node) {
      node.textContent = `实时交互停止失败: ${error.message}`;
    }
  } finally {
    setBusy(button, false);
    setRealtimeSessionButtons(false);
  }
}

async function realtimeModelStreamProbe() {
  const button = actionButtons.get("realtime-model-probe");
  setBusy(button, true, "探活中");
  const selectedAgentIds = getSelectedAgentIds();
  try {
    const response = await requestJson("/api/realtime/model/stream/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: selectedAgentIds[0] || null,
        prompt: "Reply with exactly: ok",
        max_events: 24,
        timeout_ms: 15000,
        stop_after_first_delta: false,
        record_runtime_evidence: false,
      }),
    });
    realtimeSessionStatus = {
      ...(realtimeSessionStatus || {}),
      last_model_stream_probe: response,
    };
    renderRealtimeSessionStatus(realtimeSessionStatus);
    syncRealtimeSessionTask(realtimeSessionStatus);
  } catch (error) {
    realtimeSessionStatus = {
      ...(realtimeSessionStatus || {}),
      last_model_stream_probe: {
        ok: false,
        delta_count: 0,
        runtime_evidence_recorded: false,
        error: error.message,
      },
    };
    renderRealtimeSessionStatus(realtimeSessionStatus);
    syncRealtimeSessionTask(realtimeSessionStatus);
  } finally {
    setBusy(button, false);
  }
}

async function realtimeTtsProbe() {
  const button = actionButtons.get("realtime-tts-probe");
  setBusy(button, true, "探活中");
  try {
    const response = await requestJson("/api/audio/tts/stream/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "frontend-realtime-tts-probe",
        backend: "http_streaming_tts",
        text: "streaming tts probe",
        mime_type: "audio/wav",
      }),
    });
    realtimeSessionStatus = {
      ...(realtimeSessionStatus || {}),
      last_streaming_tts_probe: response,
    };
    renderRealtimeSessionStatus(realtimeSessionStatus);
    syncRealtimeSessionTask(realtimeSessionStatus);
  } catch (error) {
    realtimeSessionStatus = {
      ...(realtimeSessionStatus || {}),
      last_streaming_tts_probe: {
        configured: false,
        reachable: false,
        chunk_received: false,
        error: error.message,
      },
    };
    renderRealtimeSessionStatus(realtimeSessionStatus);
    syncRealtimeSessionTask(realtimeSessionStatus);
  } finally {
    setBusy(button, false);
  }
}

function setRealtimeSessionButtons(running) {
  document.querySelectorAll('[data-action="realtime-session-start"]').forEach((button) => {
    button.disabled = running;
  });
  document.querySelectorAll('[data-action="realtime-session-stop"]').forEach((button) => {
    button.disabled = !running && !audioRealtimeRunning && !isDictating;
  });
}

function renderRealtimeSessionStatus(status = {}) {
  const node = document.querySelector('[data-role="realtime-session-status"]');
  setText("realtime.session", status.running ? "运行中" : "待启动");
  if (!node) return;
  const policy = status.barge_in_policy || {};
  node.textContent = JSON.stringify({
    running: Boolean(status.running),
    main_state: status.main_state || "idle",
    requested_mode: status.requested_mode || "half_duplex_guarded",
    active_mode: status.active_mode || "half_duplex_guarded",
    mode_downgrade_reason: status.mode_downgrade_reason || null,
    vision_state: status.vision_state || "off",
    audio_in_state: status.audio_in_state || "off",
    reasoning_state: status.reasoning_state || "idle",
    audio_out_state: status.audio_out_state || "idle",
    barge_in_state: status.barge_in_state || "quiet",
    frames: status.vision_frames_processed || 0,
    elements: status.vision_element_count || 0,
    audio_realtime_running: Boolean(status.audio_realtime_running),
    active_stt_transport: status.active_stt_transport || "turn_based_mediarecorder",
    audio_segments_received: status.audio_segments_received || 0,
    audio_bytes_received: status.audio_bytes_received || 0,
    audio_payload_chunks_received: status.audio_payload_chunks_received || 0,
    last_audio_payload_bytes: status.last_audio_payload_bytes || 0,
    last_audio_chunk_path: status.last_audio_chunk_path || null,
    partial_transcripts_received: status.partial_transcripts_received || 0,
    last_partial_text: status.last_partial_text || "",
    last_partial_confidence: status.last_partial_confidence ?? null,
    last_partial_is_final: Boolean(status.last_partial_is_final),
    partial_asr_provider: status.partial_asr_provider || "none",
    provider_native_stream_ready: Boolean(status.provider_native_stream_ready),
    pcm_frames_sent: status.pcm_frames_sent || 0,
    pcm_bytes_sent: status.pcm_bytes_sent || 0,
    pcm_partial_events: status.pcm_partial_events || 0,
    pcm_final_events: status.pcm_final_events || 0,
    pcm_reconnects: status.pcm_reconnects || 0,
    pcm_dropped_frames: status.pcm_dropped_frames || 0,
    pcm_max_frame_gap_ms: status.pcm_max_frame_gap_ms || 0,
    stt_available: Boolean(status.stt_available),
    tts_available: Boolean(status.tts_available),
    tts_backend: status.tts_backend || "unknown",
    index_tts_base_url: status.index_tts_base_url || null,
    index_tts_available: Boolean(status.index_tts_available),
    streaming_tts_url: status.streaming_tts_url || null,
    streaming_tts_url_configured: Boolean(status.streaming_tts_url_configured),
    streaming_tts_timeout_seconds: status.streaming_tts_timeout_seconds || 30,
    last_model_stream_probe: status.last_model_stream_probe || null,
    last_streaming_tts_probe: status.last_streaming_tts_probe || null,
    streaming_risk: status.streaming_risk || null,
    browser_aec: policy.browser_echo_cancellation !== false,
    noise_suppression: policy.noise_suppression !== false,
    auto_gain_control: policy.auto_gain_control !== false,
    sustained_speech_min_ms: policy.sustained_speech_min_ms || 1600,
    strong_interrupt_min_ms: policy.strong_interrupt_min_ms || 300,
    echo_correlation_threshold: policy.echo_correlation_threshold || 0.72,
    notes: status.notes || [],
  }, null, 2);
}

function buildRealtimeAudioConstraints({ realtime = false } = {}) {
  if (!realtime) {
    return true;
  }
  const policy = realtimeSessionStatus?.barge_in_policy || {};
  return {
    echoCancellation: policy.browser_echo_cancellation !== false,
    noiseSuppression: policy.noise_suppression !== false,
    autoGainControl: policy.auto_gain_control !== false,
  };
}

function handleRealtimeBargeInDecision(response = {}) {
  if (!response.should_interrupt) {
    return false;
  }
  audioRealtimeResumeAfterTts = false;
  audioRealtimeAwaitingReplyTts = false;
  stopActiveTtsPlayback("barge-in");
  invalidateRealtimeGeneration("barge-in");
  audioRealtimeAutoTtsEnabled = realtimeSessionRunning || audioRealtimeRunning;
  if (activeChatAbortController) {
    activeChatAbortController.abort();
  }
  showSttStatus(response.reason || "实时打断已确认，正在停止当前输出。");
  return true;
}

function activeTtsPlaybackIsRunning() {
  return Boolean(activeTtsAudio && !activeTtsAudio.paused && !activeTtsAudio.ended);
}

let sttRecorder = null;
let sttChunks = [];
let sttTailCapture = null;
let sttSessionId = null;
let isDictating = false;
let audioRealtimeRunning = false;
let audioRealtimeAutoTtsEnabled = false;
// 语音输入选中的朗读音色（持久化）；voiceInputAwaitingTts 标记"本轮回复需自动朗读"（语音输入触发）。
let selectedTtsVoice = (() => { try { return localStorage.getItem("ttsVoice") || ""; } catch { return ""; } })();
let selectedAudioOutputDeviceId = (() => { try { return localStorage.getItem("audioOutputDeviceId") || "default"; } catch { return "default"; } })();
let stopAudioOutputDeviceWatcher = null;
let voiceInputAwaitingTts = false;
let audioRealtimeAwaitingReplyTts = false;
let audioRealtimeResumeAfterTts = false;
let activeTtsAudio = null;
let activeTtsPlaybackId = 0;
let realtimeTtsChunkQueue = [];
let realtimeTtsChunkPlaying = false;
let realtimeTtsChunkPlaybackId = 0;
let audioRealtimeLastSegmentReportAt = 0;
let audioRealtimeRecognition = null;
let audioRealtimePartialSpeechStartedAt = 0;
let audioRealtimeCaptureSession = null;
let audioRealtimeBargeInDetector = null;
const audioRealtimeSpokenMessageIds = new Set();

function createRealtimeTurnController() {
  return {
    turnId: null,
    generationId: 0,
    messageId: null,
    committedText: "",
    pendingText: "",
    nextSegmentIndex: 1,
    ttsTail: Promise.resolve(),
    streamedMessageIds: new Set(),
    finalTranscriptKeys: new Set(),
  };
}

const realtimeTurn = createRealtimeTurnController();

function realtimeFullStreamActive() {
  return realtimeSessionRunning
    && String(realtimeSessionStatus?.active_mode || "") === "full_streaming";
}

function realtimeFullStreamRequested() {
  return realtimeSessionRunning
    && String(realtimeSessionStatus?.requested_mode || "") === "full_streaming";
}

function realtimeFullStreamOperational() {
  if (realtimeFullStreamActive()) return true;
  if (!realtimeFullStreamRequested()) return false;
  return Boolean(
    realtimeSessionStatus?.provider_native_stream_ready
    || audioRealtimeCaptureSession?.mode === "audio_worklet_pcm",
  );
}

async function stopRealtimeVoiceCapture() {
  const capture = audioRealtimeCaptureSession;
  audioRealtimeCaptureSession = null;
  audioRealtimeBargeInDetector?.reset?.();
  audioRealtimeBargeInDetector = null;
  if (!capture) return;
  try {
    await capture.stop();
  } catch (error) {
    console.warn("实时 PCM 采集停止失败:", error);
  }
}

function handleRealtimeVoiceStreamEvent(event = {}) {
  const type = String(event.type || "");
  if (type === "partial" || type === "final") {
    audioRealtimeBargeInDetector?.transcriptObserved?.();
    const text = String(event.text || "").trim();
    if (!text) return;
    reportAudioRealtimePartial({
      text,
      confidence: event.confidence,
      isFinal: type === "final",
      speechMs: event.speech_ms,
      ttsPlaying: activeTtsPlaybackIsRunning(),
      provider: event.provider || "provider_native_streaming_asr",
      language: event.language || navigator.language || "zh-CN",
    });
    if (type === "final") {
      void submitRealtimeFinalTranscript(text, {
        provider: event.provider || "provider_native_streaming_asr",
      });
    }
    return;
  }
  if (type === "error") {
    showSttStatus(`实时流式 STT 失败: ${event.code || "stream_error"} ${event.message || ""}`.trim());
  }
}

function handleRealtimeAudioLevel(level) {
  if (!activeTtsPlaybackIsRunning() || !audioRealtimeBargeInDetector) return;
  const decision = audioRealtimeBargeInDetector.push(level);
  if (decision.action === "duck" && activeTtsAudio) {
    activeTtsAudio.volume = 0.2;
    return;
  }
  if (decision.action === "cancel") {
    stopActiveTtsPlayback("local-two-stage-barge-in");
    invalidateRealtimeGeneration("local-two-stage-barge-in");
    return;
  }
  if ((decision.action === "restore" || decision.action === "resume") && activeTtsAudio) {
    activeTtsAudio.volume = 1;
    if (decision.action === "resume" && activeTtsAudio.paused) {
      activeTtsAudio.play().catch(() => {});
    }
  }
}

function newRealtimeTurnId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `realtime-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function realtimeFinalTranscriptKey(text, now = Date.now()) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
  return `${normalized}|${Math.floor(now / 2000)}`;
}

async function submitRealtimeFinalTranscript(text, { provider = "unknown" } = {}) {
  const transcript = String(text || "").trim();
  if (!transcript || !realtimeFullStreamOperational()) return false;
  const key = realtimeFinalTranscriptKey(transcript);
  if (realtimeTurn.finalTranscriptKeys.has(key)) return false;
  if (realtimeTurn.finalTranscriptKeys.size >= 64) {
    realtimeTurn.finalTranscriptKeys.clear();
  }
  realtimeTurn.finalTranscriptKeys.add(key);
  stopActiveTtsPlayback("new-realtime-turn");
  invalidateRealtimeGeneration("new-realtime-turn");
  realtimeTurn.turnId = newRealtimeTurnId();
  audioRealtimeAwaitingReplyTts = true;
  audioRealtimeAutoTtsEnabled = true;
  const input = document.querySelector('[data-role="message-input"]');
  if (!input) return false;
  input.value = transcript;
  input.focus();
  emitLocalRealtimeSessionEvent("full_stream_turn_started", {
    turn_id: realtimeTurn.turnId,
    generation_id: realtimeTurn.generationId,
    provider,
  });
  await sendMessage({ replaceActive: true });
  return true;
}

function invalidateRealtimeGeneration(reason = "cancelled") {
  realtimeTurn.generationId += 1;
  realtimeTurn.pendingText = "";
  realtimeTurn.committedText = "";
  realtimeTurn.messageId = null;
  realtimeTurn.nextSegmentIndex = 1;
  realtimeTurn.ttsTail = Promise.resolve();
  emitLocalRealtimeSessionEvent("full_stream_generation_invalidated", {
    turn_id: realtimeTurn.turnId,
    generation_id: realtimeTurn.generationId,
    reason,
  });
}

function takeRealtimeSpeechSegments(text, { flush = false } = {}) {
  const source = String(text || "");
  const segments = [];
  let cursor = 0;
  const boundary = /[。！？!?；;\n]/g;
  for (let match = boundary.exec(source); match; match = boundary.exec(source)) {
    const end = match.index + match[0].length;
    const segment = source.slice(cursor, end).trim();
    if (segment) segments.push(segment);
    cursor = end;
  }
  let rest = source.slice(cursor);
  if (!flush && rest.length >= 48) {
    const punctuation = Math.max(rest.lastIndexOf("，", 48), rest.lastIndexOf(",", 48));
    const splitAt = punctuation >= 24 ? punctuation : 47;
    const segment = rest.slice(0, splitAt + 1).trim();
    if (segment) segments.push(segment);
    rest = rest.slice(splitAt + 1);
  }
  if (flush && rest.trim()) {
    segments.push(rest.trim());
    rest = "";
  }
  return { segments, rest };
}

function queueRealtimeSpeechSegment(text, messageId) {
  const segment = String(text || "").trim();
  if (!segment || !realtimeTurn.turnId) return;
  const turnId = realtimeTurn.turnId;
  const generationId = realtimeTurn.generationId;
  const segmentIndex = realtimeTurn.nextSegmentIndex++;
  realtimeTurn.committedText += segment;
  if (messageId) realtimeTurn.streamedMessageIds.add(messageId);
  realtimeTurn.ttsTail = realtimeTurn.ttsTail
    .then(async () => {
      if (generationId !== realtimeTurn.generationId || turnId !== realtimeTurn.turnId) return null;
      return ttsStreamText(segment, {
        source: "realtime-delta",
        voice: selectedTtsVoice,
        turnId,
        generationId,
        segmentIndex,
      });
    })
    .catch((error) => {
      if (generationId === realtimeTurn.generationId) {
        showSttStatus("实时增量朗读失败: " + error.message);
      }
      return null;
    });
}

function commitRealtimeAssistantDelta(data = {}) {
  if (!realtimeFullStreamOperational() || !realtimeTurn.turnId) return false;
  const messageId = data.id || realtimeTurn.messageId;
  if (realtimeTurn.messageId && messageId && realtimeTurn.messageId !== messageId) return false;
  realtimeTurn.messageId = messageId || realtimeTurn.messageId;
  realtimeTurn.pendingText += String(data.delta || "");
  const extracted = takeRealtimeSpeechSegments(realtimeTurn.pendingText);
  realtimeTurn.pendingText = extracted.rest;
  extracted.segments.forEach((segment) => queueRealtimeSpeechSegment(segment, messageId));
  return extracted.segments.length > 0;
}

function flushRealtimeAssistantSpeech(data = {}) {
  if (!realtimeFullStreamOperational() || !realtimeTurn.turnId) return false;
  const messageId = data.id || realtimeTurn.messageId;
  const extracted = takeRealtimeSpeechSegments(realtimeTurn.pendingText, { flush: true });
  realtimeTurn.pendingText = extracted.rest;
  extracted.segments.forEach((segment) => queueRealtimeSpeechSegment(segment, messageId));
  return extracted.segments.length > 0;
}

async function refreshAudioStatus() {
  setText("audio.stt", "检测中");
  setText("audio.tts", "检测中");
  setText("audio.indexTts", "检测中");
  setText("audio.realtime", "检测中");
  try {
    const [statusResp, voicesResp, realtimeResp] = await Promise.all([
      fetch("/api/audio/status"),
      fetch("/api/audio/voices"),
      fetch("/api/audio/realtime/status"),
    ]);
    const status = await statusResp.json();
    const voices = await voicesResp.json();
    const realtime = await realtimeResp.json();
    const sttBtn = actionButtons.get("stt-dictate");
    const ttsBtn = actionButtons.get("tts-speak");
    setText("audio.stt", status.stt_available ? "可用" : "不可用");
    setText("audio.tts", status.tts_available ? "可用" : "不可用");
    setText(
      "audio.indexTts",
      voices.index_tts_available
        ? `可用 ${voices.backend}`
        : voices.index_tts_base_url
          ? "已配置，未连接"
          : "未配置",
    );
    setText("audio.realtime", realtime.running ? "运行中" : "待启动");
    audioRealtimeRunning = Boolean(realtime.running);
    if (audioRealtimeRunning || !audioRealtimeAwaitingReplyTts) {
      audioRealtimeAutoTtsEnabled = Boolean(realtime.auto_tts_reply);
    }
    renderAudioRealtimeStatus(realtime, voices);
    setAudioRealtimeButtons(audioRealtimeRunning);
    if (sttBtn) {
      sttBtn.disabled = !status.stt_available;
      sttBtn.title = status.stt_available ? "点击开始听写" : (status.error || "STT 不可用");
    }
    if (ttsBtn) {
      ttsBtn.disabled = !status.tts_available;
      ttsBtn.title = status.tts_available ? "朗读最后一条回复" : (status.error || "TTS 不可用");
    }
  } catch (e) {
    console.warn("音频状态检测失败:", e);
    setText("audio.stt", "状态不可用");
    setText("audio.tts", "状态不可用");
    setText("audio.indexTts", "状态不可用");
    setText("audio.realtime", "状态不可用");
  }
}

function renderAudioRealtimeStatus(status = {}, voices = {}) {
  const node = document.querySelector('[data-role="audio-realtime-status"]');
  if (!node) return;
  node.textContent = JSON.stringify({
    running: Boolean(status.running),
    mode: status.mode || "push_to_talk",
    auto_send_transcript: Boolean(status.auto_send_transcript),
    auto_tts_reply: Boolean(status.auto_tts_reply),
    awaiting_reply_tts: Boolean(audioRealtimeAwaitingReplyTts),
    resume_after_tts: Boolean(audioRealtimeResumeAfterTts),
    session_id: status.session_id || null,
    active_stt_transport: status.active_stt_transport || "turn_based_mediarecorder",
    audio_segments_received: status.audio_segments_received || 0,
    audio_bytes_received: status.audio_bytes_received || 0,
    audio_payload_chunks_received: status.audio_payload_chunks_received || 0,
    last_audio_payload_bytes: status.last_audio_payload_bytes || 0,
    last_audio_chunk_path: status.last_audio_chunk_path || null,
    last_segment_report_at: audioRealtimeLastSegmentReportAt || 0,
    partial_transcripts_received: status.partial_transcripts_received || 0,
    last_partial_text: status.last_partial_text || "",
    last_partial_confidence: status.last_partial_confidence ?? null,
    last_partial_is_final: Boolean(status.last_partial_is_final),
    partial_asr_provider: status.partial_asr_provider || "none",
    stt_available: Boolean(status.stt_available),
    tts_available: Boolean(status.tts_available),
    tts_backend: status.tts_backend || voices.backend || "piper",
    index_tts_base_url: status.index_tts_base_url || voices.index_tts_base_url || null,
    index_tts_available: Boolean(status.index_tts_available ?? voices.index_tts_available),
    voices: Array.isArray(voices.voices) ? voices.voices.length : 0,
    last_text: status.last_text || "",
    last_error: status.last_error || "",
  }, null, 2);
}

function setAudioRealtimeButtons(running) {
  document.querySelectorAll('[data-action="audio-realtime-start"]').forEach((button) => {
    button.disabled = running;
  });
  document.querySelectorAll('[data-action="audio-realtime-stop"]').forEach((button) => {
    button.disabled = !running && !isDictating;
  });
}

async function stopAudioRealtimeState({ keepAutoTtsPending = false } = {}) {
  await stopRealtimeVoiceCapture();
  stopAudioRealtimePartialRecognition();
  const status = await requestJson("/api/audio/realtime/stop", { method: "POST" });
  audioRealtimeRunning = false;
  if (!keepAutoTtsPending) {
    audioRealtimeAutoTtsEnabled = false;
    audioRealtimeAwaitingReplyTts = false;
    audioRealtimeResumeAfterTts = false;
  }
  setText("audio.realtime", "待启动");
  renderAudioRealtimeStatus(status);
  return status;
}

async function audioRealtimeStart({ backendStarted = false, status = null } = {}) {
  try {
    let realtimeStatus = status;
    if (!backendStarted) {
      realtimeStatus = await requestJson("/api/audio/realtime/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_send_transcript: true, auto_tts_reply: true }),
      });
    } else if (!realtimeStatus) {
      realtimeStatus = await requestJson("/api/audio/realtime/status");
    }
    audioRealtimeRunning = Boolean(realtimeStatus?.audio_realtime_running ?? realtimeStatus?.running ?? true);
    audioRealtimeAutoTtsEnabled = Boolean(realtimeStatus?.auto_tts_reply);
    audioRealtimeAwaitingReplyTts = false;
    audioRealtimeResumeAfterTts = false;
    setText("audio.realtime", audioRealtimeRunning ? "运行中" : "待启动");
    renderAudioRealtimeStatus(realtimeStatus || {});
    setAudioRealtimeButtons(audioRealtimeRunning);
    if (realtimeFullStreamRequested() && globalThis.CoolzhuRealtimeVoiceCapture?.createSession) {
      await stopRealtimeVoiceCapture();
      sttSessionId = realtimeStatus?.session_id || realtimeSessionStatus?.session_id || newRealtimeTurnId();
      audioRealtimeBargeInDetector = globalThis.CoolzhuRealtimeAudioOutput?.createBargeInDetector?.();
      audioRealtimeCaptureSession = await globalThis.CoolzhuRealtimeVoiceCapture.createSession({
        sessionId: sttSessionId,
        frameMs: 20,
        reconnectBufferMs: 8000,
        requirePhysical: true,
        onEvent: handleRealtimeVoiceStreamEvent,
        onAudioLevel: handleRealtimeAudioLevel,
        onSegment: (blob, metadata) => reportAudioRealtimeSegment(blob, metadata),
        onStats: (captureStats) => {
          realtimeSessionStatus = {
            ...realtimeSessionStatus,
            physical_microphone_label: captureStats.selectedInputLabel,
            pcm_frames_sent: captureStats.frames,
            pcm_bytes_sent: captureStats.bytes,
            pcm_dropped_frames: captureStats.droppedFrames,
            pcm_reconnects: captureStats.reconnects,
            pcm_max_frame_gap_ms: captureStats.maxFrameGapMs,
          };
          renderRealtimeSessionStatus(realtimeSessionStatus);
        },
      });
      isDictating = true;
      showSttStatus(audioRealtimeCaptureSession.mode === "audio_worklet_pcm"
        ? `实时麦克风已连接: ${audioRealtimeCaptureSession.selectedDevice.label}`
        : "AudioWorklet 不可用，已降级为 MediaRecorder");
    } else {
      await sttStartDictation({ realtime: true });
      startAudioRealtimePartialRecognition();
    }
  } catch (error) {
    if (audioRealtimeRunning && !backendStarted) {
      try {
        await stopAudioRealtimeState();
      } catch (_) {
        audioRealtimeRunning = false;
        setText("audio.realtime", "待启动");
      }
    }
    if (backendStarted) {
      audioRealtimeRunning = false;
    }
    showSttStatus("实时语音启动失败: " + error.message);
    await refreshAudioStatus();
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Blob read failed"));
    reader.readAsDataURL(blob);
  });
}

async function reportAudioRealtimeSegment(blob, { finalSegment = false, durationMs = 250 } = {}) {
  if (!blob || !audioRealtimeRunning) {
    return null;
  }
  const now = Date.now();
  audioRealtimeLastSegmentReportAt = now;
  let audioBase64 = "";
  try {
    audioBase64 = await blobToDataUrl(blob);
  } catch (error) {
    console.warn("实时语音分段读取失败，仅上报 metadata:", error);
  }
  try {
    const response = await fetch("/api/audio/realtime/segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sttSessionId,
        bytes: blob.size,
        duration_ms: Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null,
        mime_type: blob.type || "audio/webm",
        final_segment: Boolean(finalSegment),
        audio_base64: audioBase64 || undefined,
      }),
    });
    const segment = response.ok ? await response.json() : null;
    if (!segment) return null;
    realtimeSessionStatus = {
      ...realtimeSessionStatus,
      audio_segments_received: segment.audio_segments_received,
      audio_bytes_received: segment.audio_bytes_received,
      audio_payload_chunks_received: segment.audio_payload_chunks_received,
      last_audio_payload_bytes: segment.audio_payload_bytes,
      last_audio_chunk_path: segment.last_audio_chunk_path || realtimeSessionStatus?.last_audio_chunk_path || null,
      active_stt_transport: segment.active_stt_transport || "segmented_mediarecorder",
      last_partial_text: segment.asr_transcript_received ? segment.asr_text || "" : realtimeSessionStatus?.last_partial_text || "",
      last_partial_confidence: segment.asr_transcript_received ? segment.asr_confidence ?? null : realtimeSessionStatus?.last_partial_confidence ?? null,
      last_partial_is_final: segment.asr_transcript_received ? true : Boolean(realtimeSessionStatus?.last_partial_is_final),
      partial_asr_provider: segment.asr_transcript_received ? segment.asr_provider || "local_stt_final" : realtimeSessionStatus?.partial_asr_provider || "none",
      updated_at_ms: segment.updated_at_ms || now,
    };
    renderRealtimeSessionStatus(realtimeSessionStatus);
    syncRealtimeSessionTask(realtimeSessionStatus);
    if (segment.asr_attempted) {
      await refreshRealtimeSessionStatus();
    }
    return segment;
  } catch (error) {
    console.warn("实时语音分段状态上报失败:", error);
    return null;
  }
}

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startAudioRealtimePartialRecognition() {
  const SpeechRecognitionCtor = speechRecognitionConstructor();
  if (!SpeechRecognitionCtor || audioRealtimeRecognition) {
    return false;
  }
  try {
    const recognition = new SpeechRecognitionCtor();
    audioRealtimePartialSpeechStartedAt = 0;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "zh-CN";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        const text = alternative?.transcript || "";
        if (!text.trim()) continue;
        const now = Date.now();
        if (!audioRealtimePartialSpeechStartedAt) {
          audioRealtimePartialSpeechStartedAt = now;
        }
        reportAudioRealtimePartial({
          text,
          confidence: alternative?.confidence,
          isFinal: Boolean(result.isFinal),
          speechMs: Math.max(0, now - audioRealtimePartialSpeechStartedAt),
          ttsPlaying: activeTtsPlaybackIsRunning(),
          provider: "browser_speech_recognition",
          language: recognition.lang,
        });
        if (result.isFinal) {
          if (realtimeFullStreamActive()) {
            void submitRealtimeFinalTranscript(text, { provider: "browser_speech_recognition" });
          }
          audioRealtimePartialSpeechStartedAt = 0;
        }
      }
    };
    recognition.onerror = (event) => {
      console.warn("实时 partial ASR 事件失败:", event?.error || event);
    };
    recognition.onend = () => {
      audioRealtimeRecognition = null;
    };
    audioRealtimeRecognition = recognition;
    recognition.start();
    return true;
  } catch (error) {
    audioRealtimeRecognition = null;
    console.warn("实时 partial ASR 启动失败:", error);
    return false;
  }
}

function stopAudioRealtimePartialRecognition() {
  audioRealtimePartialSpeechStartedAt = 0;
  if (!audioRealtimeRecognition) {
    return;
  }
  const recognition = audioRealtimeRecognition;
  audioRealtimeRecognition = null;
  try {
    recognition.onend = null;
    recognition.stop();
  } catch (error) {
    console.warn("实时 partial ASR 停止失败:", error);
  }
}

function reportAudioRealtimePartial({
  text,
  confidence = null,
  isFinal = false,
  speechMs = null,
  ttsPlaying = activeTtsPlaybackIsRunning(),
  echoCorrelation = null,
  provider = "browser_speech_recognition",
  language = navigator.language || "zh-CN",
} = {}) {
  const transcript = String(text || "").trim();
  if (!transcript || !audioRealtimeRunning) {
    return;
  }
  const numericConfidence = Number(confidence);
  fetch("/api/audio/realtime/partial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sttSessionId,
      text: transcript,
      confidence: Number.isFinite(numericConfidence) ? numericConfidence : null,
      is_final: Boolean(isFinal),
      speech_ms: Number.isFinite(Number(speechMs)) ? Math.max(0, Math.round(Number(speechMs))) : null,
      tts_playing: Boolean(ttsPlaying),
      echo_correlation: Number.isFinite(Number(echoCorrelation)) ? Number(echoCorrelation) : null,
      vad_active: true,
      provider,
      language,
    }),
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((partial) => {
      if (!partial) return;
      realtimeSessionStatus = {
        ...realtimeSessionStatus,
        partial_transcripts_received: partial.partial_transcripts_received,
        last_partial_text: partial.last_partial_text || transcript,
        last_partial_confidence: partial.last_partial_confidence,
        last_partial_is_final: Boolean(partial.last_partial_is_final),
        partial_asr_provider: partial.partial_asr_provider || provider,
        barge_in_state: partial.barge_in_state || realtimeSessionStatus.barge_in_state || "quiet",
        audio_out_state: partial.should_interrupt ? "cancelled" : realtimeSessionStatus.audio_out_state,
        updated_at_ms: partial.updated_at_ms || Date.now(),
      };
      if (partial.barge_in_decision || partial.barge_in_state) {
        handleRealtimeBargeInDecision({
          decision: partial.barge_in_decision,
          barge_in_state: partial.barge_in_state,
          should_interrupt: Boolean(partial.should_interrupt),
          reason: partial.barge_in_reason,
          recommended_action: partial.barge_in_recommended_action,
        });
      }
      renderRealtimeSessionStatus(realtimeSessionStatus);
      syncRealtimeSessionTask(realtimeSessionStatus);
    })
    .catch((error) => {
      console.warn("实时 partial ASR 状态上报失败:", error);
    });
}

async function audioRealtimeStop() {
  audioRealtimeResumeAfterTts = false;
  audioRealtimeAwaitingReplyTts = false;
  stopAudioRealtimePartialRecognition();
  await stopRealtimeVoiceCapture();
  isDictating = false;
  stopActiveTtsPlayback("audio-realtime-stop");
  if (sttRecorder && sttRecorder.state !== "inactive") {
    await sttStopDictation();
    return;
  }
  try {
    await stopAudioRealtimeState();
  } catch (error) {
    showSttStatus("实时语音停止失败: " + error.message);
  } finally {
    setAudioRealtimeButtons(false);
  }
}

async function initTtsVoiceSelector() {
  const select = document.querySelector('[data-role="tts-voice"]');
  if (!select) return;
  try {
    const data = await requestJson("/api/audio/voices");
    let voices = Array.isArray(data.voices) ? data.voices : [];
    // 只展示中文音色（名称含中文），不显示英文内置音色。
    voices = voices.filter((v) => /[一-龥]/.test(v.name || ""));
    select.innerHTML = "";
    for (const v of voices) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name;
      select.appendChild(opt);
    }
    // 默认音色用“成人男声”；历史选择若已不在列表（如旧的英文音色）也重置为默认。
    if (!selectedTtsVoice || !voices.some((v) => v.name === selectedTtsVoice)) {
      selectedTtsVoice = voices.some((v) => v.name === "成人男声") ? "成人男声" : (voices[0] ? voices[0].name : "");
      try { localStorage.setItem("ttsVoice", selectedTtsVoice); } catch (_) {}
    }
    if (selectedTtsVoice) {
      select.value = selectedTtsVoice;
    }
    select.addEventListener("change", () => {
      selectedTtsVoice = select.value;
      try { localStorage.setItem("ttsVoice", selectedTtsVoice); } catch (_) {}
    });
  } catch (error) {
    console.warn("加载音色列表失败:", error);
    select.replaceChildren();
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "音色加载失败";
    select.append(opt);
    select.disabled = true;
    select.title = error?.message || "加载音色列表失败";
    setText("audio.tts", `音色加载失败: ${error?.message || error}`);
  }
}

function realtimeStreamingTtsEnabled() {
  const status = realtimeSessionStatus || {};
  const transport = status.tts_transport || status.streaming_risk?.tts_transport || "";
  return realtimeSessionRunning
    && transport === "chunked_tts_stream"
    && Boolean(status.streaming_tts_url_configured || status.streaming_tts_url);
}

function sanitizeAssistantMessageTextForTts(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+\s*---\s*\n+Remote context usage:[\s\S]*$/i, "")
    .replace(/(^|\n)Remote context usage:[\s\S]*$/i, "$1")
    .trim();
}

async function ttsSpeakLastMessage() {
  const btn = actionButtons.get("tts-speak");
  const origLabel = btn?.textContent || "朗读";
  if (btn) { btn.textContent = "..."; btn.disabled = true; }

  const lastText = lastAssistantMessageTextForTts();
  if (!lastText) {
    if (btn) { btn.textContent = origLabel; btn.disabled = false; }
    return alert("暂无机器人回复可朗读。");
  }

  try {
    await ttsSpeakText(lastText);
  } catch (e) {
    alert("朗读失败: " + e.message);
  } finally {
    if (btn) { btn.textContent = origLabel; btn.disabled = false; }
  }
}

function lastAssistantMessageTextForTts() {
  const messages = document.querySelectorAll('.message.bot [data-role="message-content"]');
  const message = messages.length > 0 ? messages[messages.length - 1] : null;
  return sanitizeAssistantMessageTextForTts(message?.dataset?.rawText || message?.textContent || "") || null;
}

async function ttsStreamText(text, {
  source = "realtime-auto",
  voice = undefined,
  turnId = null, generationId = null, segmentIndex = null,
} = {}) {
  const speechText = String(text || "").trim();
  if (!speechText) {
    return null;
  }
  const useVoice = voice !== undefined ? voice : selectedTtsVoice;
  const resp = await fetch("/api/audio/tts/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: speechText,
      source,
      ...(useVoice ? { voice: useVoice } : {}),
      session_id: realtimeSessionStatus?.session_id || null,
      turn_id: turnId,
      generation_id: generationId,
      segment_index: segmentIndex,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "流式 TTS 请求失败");
  }
  const result = await resp.json();
  console.log("Streaming TTS:", source, `${result.chunk_count || 0} chunks`, result.bytes ? `${result.bytes} bytes` : "");
  return result;
}

async function ttsSpeakText(text, { source = "manual", voice = undefined, segmented = false, preferStreaming = false } = {}) {
  const speechText = String(text || "").trim();
  if (!speechText) {
    return null;
  }
  const useVoice = voice !== undefined ? voice : selectedTtsVoice;
  if (preferStreaming) {
    try {
      return await ttsStreamText(speechText, { source, voice: useVoice });
    } catch (error) {
      console.warn("流式 TTS 不可用，回落到分段 TTS:", error);
    }
  }
  const resp = await fetch("/api/audio/tts/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: speechText,
      source,
      auto_play: false,
      segment: Boolean(segmented),
      ...(useVoice ? { voice: useVoice } : {}),
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "TTS 请求失败");
  }
  const result = await resp.json();
  const audioUrls = Array.isArray(result.audio_urls) && result.audio_urls.length
    ? result.audio_urls
    : (result.audio_url ? [result.audio_url] : []);
  if (audioUrls.length > 0) {
    await playTtsAudioQueue(audioUrls, { source });
  } else if (!result.played) {
    throw new Error("TTS 已合成但没有可播放的 audio_url");
  }
  console.log("TTS:", source, result.audio_path, result.duration_ms + "ms", audioUrls.length ? `(前端队列播放 ${audioUrls.length})` : "(后端播放)");
  return result;
}

function stopActiveTtsPlayback(reason = "manual") {
  activeTtsPlaybackId += 1;
  if (reason !== "realtime-tts-chunk") {
    realtimeTtsChunkQueue = [];
    realtimeTtsChunkPlaying = false;
    realtimeTtsChunkPlaybackId = 0;
  }
  const audio = activeTtsAudio;
  activeTtsAudio = null;
  if (!audio) {
    return false;
  }
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch (error) {
    console.warn("停止 TTS 播放失败:", reason, error);
  }
  return true;
}

function realtimeTtsChunkMatchesActiveGeneration(payload = {}) {
  if (!realtimeFullStreamOperational()) {
    return true;
  }
  const source = String(payload.source || "").trim();
  const payloadTurnId = String(payload.turn_id || "").trim();
  const payloadGenerationId = Number(payload.generation_id);
  const hasGenerationId = payload.generation_id !== null
    && payload.generation_id !== undefined
    && Number.isFinite(payloadGenerationId);
  if (!payloadTurnId || !hasGenerationId) {
    return source !== "realtime-delta";
  }
  return payloadTurnId === realtimeTurn.turnId
    && payloadGenerationId === realtimeTurn.generationId;
}

function enqueueRealtimeTtsChunk(payload = {}) {
  if (!realtimeTtsChunkMatchesActiveGeneration(payload)) {
    return null;
  }
  const audioUrl = String(payload.audio_url || "").trim();
  if (!audioUrl) {
    return null;
  }
  const chunk = {
    audio_url: audioUrl,
    source: payload.source || "streaming_tts",
    index: payload.index ?? payload.chunk_index ?? (realtimeTtsChunkQueue.length + 1),
    total: payload.total ?? payload.chunk_count ?? null,
    final_chunk: Boolean(payload.final_chunk),
  };
  if (!realtimeTtsChunkPlaying && realtimeTtsChunkQueue.length === 0) {
    stopActiveTtsPlayback("realtime-tts-chunk");
    realtimeTtsChunkPlaybackId = activeTtsPlaybackId;
    emitLocalRealtimeSessionEvent("tts_playback_started", {
      source: chunk.source,
      backend: "browser-stream",
      total: chunk.total,
      segment_count: chunk.total,
    });
  }
  realtimeTtsChunkQueue.push(chunk);
  void drainRealtimeTtsChunkQueue();
  return chunk;
}

async function drainRealtimeTtsChunkQueue() {
  if (realtimeTtsChunkPlaying) {
    return;
  }
  realtimeTtsChunkPlaying = true;
  const playbackId = realtimeTtsChunkPlaybackId || activeTtsPlaybackId;
  let played = 0;
  let lastSource = "streaming_tts";
  let sawFinal = false;
  try {
    while (realtimeTtsChunkQueue.length > 0) {
      if (activeTtsPlaybackId !== playbackId) {
        realtimeTtsChunkQueue = [];
        emitLocalRealtimeSessionEvent("tts_playback_stopped", {
          source: lastSource,
          backend: "browser-stream",
          played,
        });
        return;
      }
      const next = realtimeTtsChunkQueue.shift();
      if (!next) {
        break;
      }
      lastSource = next.source || lastSource;
      emitLocalRealtimeSessionEvent("tts_playback_segment", {
        source: lastSource,
        backend: "browser-stream",
        index: next.index,
        total: next.total,
      });
      const result = await playTtsAudioUrl(next.audio_url, {
        source: lastSource,
        replace: false,
        playbackId,
      });
      played += 1;
      sawFinal = sawFinal || next.final_chunk;
      if (activeTtsPlaybackId !== playbackId || result?.status === "stopped") {
        realtimeTtsChunkQueue = [];
        emitLocalRealtimeSessionEvent("tts_playback_stopped", {
          source: lastSource,
          backend: "browser-stream",
          played,
          total: next.total,
        });
        return;
      }
    }
    if (sawFinal) {
      emitLocalRealtimeSessionEvent("tts_playback_ended", {
        source: lastSource,
        backend: "browser-stream",
        played,
      });
      realtimeTtsChunkPlaybackId = 0;
    }
  } catch (error) {
    realtimeTtsChunkQueue = [];
    emitLocalRealtimeSessionEvent("tts_playback_stopped", {
      source: lastSource,
      backend: "browser-stream",
      played,
      error: error.message,
    });
  } finally {
    realtimeTtsChunkPlaying = false;
  }
}

async function playTtsAudioQueue(audioUrls, { source = "manual" } = {}) {
  const urls = (Array.isArray(audioUrls) ? audioUrls : [audioUrls])
    .map((url) => String(url || "").trim())
    .filter(Boolean);
  if (urls.length === 0) {
    return null;
  }
  stopActiveTtsPlayback("replace");
  const playbackId = activeTtsPlaybackId;
  const results = [];
  emitLocalRealtimeSessionEvent("tts_playback_started", {
    source,
    backend: "browser",
    total: urls.length,
    segment_count: urls.length,
  });
  for (let index = 0; index < urls.length; index += 1) {
    if (activeTtsPlaybackId !== playbackId) {
      emitLocalRealtimeSessionEvent("tts_playback_stopped", {
        source,
        backend: "browser",
        played: results.length,
        total: urls.length,
      });
      return { source, status: "stopped", played: results.length, total: urls.length, results };
    }
    emitLocalRealtimeSessionEvent("tts_playback_segment", {
      source,
      backend: "browser",
      index: index + 1,
      total: urls.length,
    });
    let result;
    try {
      result = await playTtsAudioUrl(urls[index], {
        source,
        replace: false,
        playbackId,
      });
    } catch (error) {
      emitLocalRealtimeSessionEvent("tts_playback_stopped", {
        source,
        backend: "browser",
        played: results.length,
        total: urls.length,
        error: error.message,
      });
      throw error;
    }
    results.push(result);
    if (activeTtsPlaybackId !== playbackId || result?.status === "stopped") {
      emitLocalRealtimeSessionEvent("tts_playback_stopped", {
        source,
        backend: "browser",
        played: results.length,
        total: urls.length,
      });
      return { source, status: "stopped", played: results.length, total: urls.length, results };
    }
  }
  emitLocalRealtimeSessionEvent("tts_playback_ended", {
    source,
    backend: "browser",
    played: results.length,
    total: urls.length,
  });
  return { source, status: "ended", played: results.length, total: urls.length, results };
}

// P2 远端参考 AEC（far_end_reference gate）：TTS 播放时把播放音频接 WebAudio 参考 tap，
// 周期估计参考能量（0-1）并上报 /api/audio/realtime/aec-reference 作为运行时证据；
// 实时会话运行中才会置 gate ready（后端校验）。播放结束上报 reference_active=false。
let aecReferenceCtx = null;
let aecReferenceLastReportMs = 0;
function attachAecFarEndReference(audio) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !audio) return;
    if (!aecReferenceCtx) aecReferenceCtx = new Ctx();
    globalThis.CoolzhuRealtimeAudioOutput?.applyContextSink?.(
      aecReferenceCtx,
      selectedAudioOutputDeviceId,
      { generationId: realtimeTurn.generationId, currentGeneration: () => realtimeTurn.generationId },
    ).catch(() => {});
    if (aecReferenceCtx.state === "suspended") {
      aecReferenceCtx.resume().catch(() => {});
    }
    const sourceNode = aecReferenceCtx.createMediaElementSource(audio);
    const analyser = aecReferenceCtx.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);
    analyser.connect(aecReferenceCtx.destination); // 保持正常出声
    const levels = new Uint8Array(analyser.frequencyBinCount);
    const timer = window.setInterval(() => {
      if (audio.paused || audio.ended || activeTtsAudio !== audio) {
        window.clearInterval(timer);
        reportAecReference(false, 0, 0);
        return;
      }
      analyser.getByteFrequencyData(levels);
      let sum = 0;
      for (let i = 0; i < levels.length; i += 1) sum += levels[i];
      const level = sum / (levels.length * 255);
      const now = Date.now();
      if (now - aecReferenceLastReportMs >= 1000) {
        aecReferenceLastReportMs = now;
        reportAecReference(true, Number(level.toFixed(3)), levels.length);
      }
    }, 250);
  } catch {
    // createMediaElementSource 对同一元素只能调用一次 / 自动播放策略拒绝时静默忽略，
    // 不影响 TTS 正常播放；gate 如实保持 not ready。
  }
}

function reportAecReference(active, correlation, sampleCount = 0) {
  fetch("/api/audio/realtime/aec-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: realtimeSessionStatus?.session_id || null,
      reference_active: active,
      correlation,
      source: "webaudio_far_end_reference_pcm",
      generation_id: realtimeTurn.generationId,
      sample_count: sampleCount,
      browser_echo_cancellation: audioRealtimeCaptureSession?.stats?.echoCancellation === true,
    }),
  }).catch(() => {});
}

function ensureAudioOutputDeviceWatcher() {
  if (stopAudioOutputDeviceWatcher || !globalThis.CoolzhuRealtimeAudioOutput?.watchOutputDevice) return;
  stopAudioOutputDeviceWatcher = globalThis.CoolzhuRealtimeAudioOutput.watchOutputDevice(
    selectedAudioOutputDeviceId,
    (device, { fellBackToDefault } = {}) => {
      if (!fellBackToDefault || selectedAudioOutputDeviceId === "default") return;
      selectedAudioOutputDeviceId = device?.deviceId || "default";
      try { localStorage.setItem("audioOutputDeviceId", selectedAudioOutputDeviceId); } catch (_) {}
      showSttStatus("所选扬声器已断开，已回退到系统默认输出。");
    },
  );
}

function playTtsAudioUrl(audioUrl, { source = "manual", replace = true, playbackId = null } = {}) {
  const url = String(audioUrl || "").trim();
  if (!url) {
    return Promise.resolve(null);
  }
  if (replace) {
    stopActiveTtsPlayback("replace");
  }
  const activePlaybackId = playbackId ?? activeTtsPlaybackId;
  const generationId = realtimeTurn.generationId;
  const audio = new Audio(url);
  activeTtsAudio = audio;
  audio.preload = "auto";
  attachAecFarEndReference(audio); // P2: TTS 播放接远端参考 tap（far_end_reference AEC 证据）
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("pause", onPause);
      if (activeTtsAudio === audio) {
        activeTtsAudio = null;
      }
    };
    const onEnded = () => {
      cleanup();
      resolve({ source, status: "ended" });
    };
    const onError = () => {
      cleanup();
      reject(new Error("TTS 音频播放失败"));
    };
    const onPause = () => {
      if (activeTtsPlaybackId !== activePlaybackId || activeTtsAudio !== audio) {
        cleanup();
        resolve({ source, status: "stopped" });
      }
    };
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.addEventListener("pause", onPause);
    ensureAudioOutputDeviceWatcher();
    Promise.resolve(globalThis.CoolzhuRealtimeAudioOutput?.applyOutputSink?.(
      audio,
      selectedAudioOutputDeviceId,
      { generationId, currentGeneration: () => realtimeTurn.generationId },
    ))
      .then(() => audio.play())
      .then(() => emitLocalRealtimeSessionEvent("tts_playing", {
        source,
        generation_id: generationId,
        output_device_id: selectedAudioOutputDeviceId,
      }))
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });
}

async function sttDictateToggle() {
  if (isDictating) {
    await sttStopDictation();
  } else {
    await sttStartDictation();
  }
}

async function sttStartDictation({ realtime = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    showSttStatus("浏览器不支持麦克风录音，请使用 Chrome/Edge 打开此页面");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: buildRealtimeAudioConstraints({ realtime }),
    });
    sttChunks = [];
    if (realtime) {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");
      sttRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      sttRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          sttChunks.push(e.data);
          reportAudioRealtimeSegment(e.data);
        }
      };
      sttRecorder.onstop = () => sttFinishDictation();
      sttRecorder.start(250);
    } else {
      if (!globalThis.CoolzhuSttTailCapture?.createSession) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("最后 60 秒录音模块未加载，请刷新页面后重试");
      }
      sttRecorder = null;
      sttTailCapture = await globalThis.CoolzhuSttTailCapture.createSession({
        stream,
        maxDurationMs: 60000,
        targetSampleRate: 16000,
      });
    }
    isDictating = true;
    audioRealtimeRunning = realtime || audioRealtimeRunning;

    try {
      const resp = await fetch("/api/audio/stt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encoder: realtime ? "webm" : "wav", sample_rate: 16000 }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.session_id) {
        throw new Error(data.error || `STT 会话启动失败 (${resp.status})`);
      }
      sttSessionId = data.session_id;
    } catch (e) {
      if (sttTailCapture) {
        const capture = sttTailCapture;
        sttTailCapture = null;
        await capture.stop().catch(() => {});
      }
      if (sttRecorder && sttRecorder.state !== "inactive") {
        sttRecorder.onstop = null;
        sttRecorder.stop();
        sttRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      throw e;
    }

    renderSttDictationButton("停止", { recording: true });
    setAudioRealtimeButtons(audioRealtimeRunning);
    showSttStatus("");
  } catch (e) {
    isDictating = false;
    sttTailCapture = null;
    renderSttDictationButton("语音输入");
    if (e.name === "NotAllowedError") {
      showSttStatus("麦克风权限未授予，请点击浏览器地址栏左侧的锁图标，允许麦克风访问后刷新页面");
    } else if (e.name === "NotFoundError") {
      showSttStatus("未检测到麦克风设备，请插入麦克风后重试");
    } else if (e.message === "audio_worklet_unavailable") {
      showSttStatus("当前浏览器不支持可靠的最后 60 秒录音，请使用最新版 Chrome/Edge");
    } else {
      showSttStatus("麦克风启动失败: " + e.message);
    }
  }
}

function renderSttDictationButton(label, { recording = false, disabled = false } = {}) {
  const btn = actionButtons.get("stt-dictate");
  if (!btn) return;
  const icon = document.createElement("img");
  icon.src = iconUrl("microphone");
  icon.alt = "";
  btn.replaceChildren(icon, label);
  btn.classList.toggle("is-recording", recording);
  btn.disabled = disabled;
}

function showSttStatus(msg) {
  let el = document.querySelector(".stt-status");
  if (!el && msg) {
    el = document.createElement("div");
    el.className = "stt-status";
    const composer = document.querySelector(".composer");
    composer?.after(el);
  }
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
    if (msg) {
      el.style.cssText = "text-align:center;padding:6px 12px;margin:4px 0;background:#2c1810;border:1px solid #c0392b;color:#ffc526;font-size:13px;border-radius:3px;";
    }
  }
}

async function sttStopDictation() {
  if (sttTailCapture) {
    const capture = sttTailCapture;
    sttTailCapture = null;
    isDictating = false;
    renderSttDictationButton("处理中", { disabled: true });
    try {
      const result = await capture.stop();
      await sttFinishDictation(result.blob, "wav");
    } catch (error) {
      showSttStatus("听写失败: " + error.message);
      renderSttDictationButton("语音输入");
    }
    return;
  }

  if (!sttRecorder || sttRecorder.state === "inactive") return;
  sttRecorder.stop();
  sttRecorder.stream.getTracks().forEach((track) => track.stop());
  isDictating = false;
  renderSttDictationButton("处理中", { disabled: true });
  setAudioRealtimeButtons(audioRealtimeRunning);
}

async function sttFinishDictation(recordedBlob = null, extension = "webm") {
  if (!sttSessionId || (!recordedBlob && sttChunks.length === 0)) {
    if (audioRealtimeRunning) {
      try {
        await stopAudioRealtimeState();
      } catch (_) {
        audioRealtimeRunning = false;
        setText("audio.realtime", "待启动");
      }
    }
    sttSessionId = null;
    sttChunks = [];
    setAudioRealtimeButtons(false);
    return;
  }

  renderSttDictationButton("处理中", { disabled: true });

  try {
    const blob = recordedBlob || new Blob(sttChunks, { type: "audio/webm" });
    if (!blob.size) {
      throw new Error("未检测到音频");
    }
    let transcriptText = "";
    if (audioRealtimeRunning || realtimeSessionRunning) {
      const finalSegment = await reportAudioRealtimeSegment(blob, { finalSegment: true, durationMs: null });
      const realtimeFinalText = String(finalSegment?.asr_text || "").trim();
      if (finalSegment?.asr_transcript_received && realtimeFinalText) {
        transcriptText = realtimeFinalText;
      }
    }

    if (!transcriptText) {
      const formData = new FormData();
      formData.append("audio", blob, extension === "wav"
        ? `stt_${sttSessionId}.wav`
        : `stt_${sttSessionId}.webm`);

      const uploadResp = await fetch("/api/audio/stt/data", {
        method: "POST",
        body: formData,
      });

      if (!uploadResp.ok) {
        const uploadError = await uploadResp.json().catch(() => ({}));
        throw new Error(uploadError.error || `音频上传失败 (${uploadResp.status})`);
      }

      const stopResp = await fetch("/api/audio/stt/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sttSessionId }),
      });

      if (!stopResp.ok) {
        const stopError = await stopResp.json().catch(() => ({}));
        throw new Error(stopError.error || `转写失败 (${stopResp.status})`);
      }

      const result = await stopResp.json();
      transcriptText = String(result.text || "").trim();
    }

    const input = document.querySelector('[data-role="message-input"]');
    if (input && transcriptText) {
      input.value = transcriptText;
      input.focus();
      showSttStatus("");
      if (realtimeFullStreamActive()) {
        await submitRealtimeFinalTranscript(transcriptText, { provider: "mediarecorder_final" });
      } else if (audioRealtimeRunning) {
        const keepAutoTtsPending = audioRealtimeAutoTtsEnabled;
        audioRealtimeAwaitingReplyTts = keepAutoTtsPending;
        audioRealtimeResumeAfterTts = keepAutoTtsPending && realtimeSessionRunning;
        const realtimeStop = await stopAudioRealtimeState({ keepAutoTtsPending });
        renderAudioRealtimeStatus(realtimeStop);
        await sendMessage();
      } else {
        // 普通语音输入：识别后自动发送，并标记本轮大模型回复需自动朗读。
        voiceInputAwaitingTts = true;
        await sendMessage();
      }
    } else {
      if (audioRealtimeRunning) {
        await stopAudioRealtimeState();
      }
      showSttStatus("转写完成但未识别到文本，请重试");
    }
  } catch (e) {
    showSttStatus("听写失败: " + e.message);
  } finally {
    sttSessionId = null;
    sttChunks = [];
    renderSttDictationButton("语音输入");
    setAudioRealtimeButtons(audioRealtimeRunning);
  }
}
