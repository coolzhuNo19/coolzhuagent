"use strict";

const HOST_NAME = "com.coolzhu.agent.browser_bridge";
let nativePort = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
const ownedTabs = new Map();

function failure(requestId, code, message) {
  return { request_id: requestId || "missing", ok: false, error: { code, message } };
}

function normalUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

async function activeNormalTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs.find((candidate) => Number.isInteger(candidate.id) && normalUrl(candidate.url));
  if (!tab) throw new Error("restricted_page");
  return tab;
}

async function normalTabById(tabId) {
  const numericId = Number(tabId);
  if (!Number.isInteger(numericId)) throw new Error("invalid_tab_id");
  let tab;
  try {
    tab = await chrome.tabs.get(numericId);
  } catch (_error) {
    throw new Error("tab_closed");
  }
  if (!normalUrl(tab?.url)) throw new Error("restricted_page");
  return tab;
}

async function requestTab(request) {
  return request?.tab_id ? normalTabById(request.tab_id) : activeNormalTab();
}

async function relayTabAction(request) {
  const requestId = String(request.request_id || "missing");
  const action = request.action || {};
  if (action.action === "open") {
    const url = String(action.url || "");
    const ownerToken = String(action.owner_token || "");
    if (!normalUrl(url)) return failure(requestId, "restricted_url", "only http and https URLs are allowed");
    if (!ownerToken) return failure(requestId, "invalid_owner_token", "owner token is required");
    const tab = await chrome.tabs.create({ url, active: action.activate !== false });
    ownedTabs.set(tab.id, ownerToken);
    return {
      request_id: requestId,
      ok: true,
      window_id: String(tab.windowId),
      tab_id: String(tab.id),
      url,
      evidence: "owned_tab_opened",
    };
  }
  if (action.action === "activate") {
    const tab = await normalTabById(action.tab_id);
    await chrome.tabs.update(tab.id, { active: true });
    return {
      request_id: requestId,
      ok: true,
      window_id: String(tab.windowId),
      tab_id: String(tab.id),
      url: tab.url,
      evidence: "tab_activated",
    };
  }
  if (action.action === "close_owned") {
    const numericId = Number(action.tab_id);
    const ownerToken = String(action.owner_token || "");
    if (!Number.isInteger(numericId)) return failure(requestId, "invalid_tab_id", "tab id is invalid");
    if (!ownerToken || ownedTabs.get(numericId) !== ownerToken) {
      return failure(requestId, "tab_not_owned", "only tabs opened by this Computer Use task may be closed");
    }
    await chrome.tabs.remove(numericId);
    ownedTabs.delete(numericId);
    return {
      request_id: requestId,
      ok: true,
      tab_id: String(numericId),
      evidence: "owned_tab_closed",
    };
  }
  return failure(requestId, "unsupported_tab_action", "tab action is not allowlisted");
}

async function relay(request) {
  const requestId = String(request.request_id || "missing");
  if (request.type === "ping") {
    return { request_id: requestId, ok: true, browser_id: "chromium" };
  }
  if (request.type === "tab") {
    return relayTabAction(request);
  }
  const tab = await requestTab(request);
  if (request.type === "act" && request.action?.action === "navigate") {
    const url = String(request.action.url || "");
    if (!normalUrl(url)) return failure(requestId, "restricted_url", "only http and https URLs are allowed");
    await chrome.tabs.update(tab.id, { url });
    return { request_id: requestId, ok: true, tab_id: String(tab.id), url, evidence: "navigation_requested" };
  }
  if (request.type === "act" && request.action?.action === "history_back") {
    await chrome.tabs.goBack(tab.id);
    return { request_id: requestId, ok: true, tab_id: String(tab.id), evidence: "history_back_requested" };
  }
  if (request.type === "act" && request.action?.action === "history_forward") {
    await chrome.tabs.goForward(tab.id);
    return { request_id: requestId, ok: true, tab_id: String(tab.id), evidence: "history_forward_requested" };
  }
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 });
  } catch (_error) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ["content_script.js"] });
    response = await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 });
  }
  return {
    ...response,
    request_id: requestId,
    browser_id: "chromium",
    window_id: String(tab.windowId),
    tab_id: String(tab.id),
    frame_id: "0",
    url: response?.url || tab.url,
    title: response?.title || tab.title,
  };
}

async function deliverResponse(request, response) {
  const requestId = String(request?.request_id || response?.request_id || "missing");
  const replyToken = typeof request?.reply_token === "string" ? request.reply_token : "";
  try {
    nativePort?.postMessage(response);
  } catch (_error) {
    // The local HTTP reply path below is the authoritative fallback when the
    // browser->native stdin pipe is unavailable or silently drops responses.
  }
  if (!replyToken) return;
  try {
    await fetch("http://127.0.0.1:8765/api/computer-use/browser/response", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-coolzhu-browser-reply-token": replyToken,
      },
      body: JSON.stringify({ ...response, request_id: requestId }),
      cache: "no-store",
    });
  } catch (_error) {
    // Broker-side timeout remains the single terminal result if both reply
    // channels fail.
  }
}

async function onNativeMessage(request) {
  const requestId = String(request?.request_id || "missing");
  try {
    const response = await relay(request || {});
    await deliverResponse(request || {}, response);
  } catch (error) {
    const code = String(error?.message || "browser_bridge_failed");
    await deliverResponse(request || {}, failure(requestId, code, `browser bridge failed: ${code}`));
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNative();
  }, delay);
}

function connectNative() {
  if (nativePort) return;
  try {
    const port = chrome.runtime.connectNative(HOST_NAME);
    nativePort = port;
    port.onMessage.addListener((message) => void onNativeMessage(message));
    port.onDisconnect.addListener(() => {
      nativePort = null;
      scheduleReconnect();
    });
    reconnectAttempt = 0;
  } catch (_error) {
    nativePort = null;
    scheduleReconnect();
  }
}

chrome.runtime.onInstalled.addListener(connectNative);
chrome.runtime.onStartup.addListener(connectNative);
chrome.tabs.onRemoved.addListener((tabId) => ownedTabs.delete(tabId));
connectNative();
