/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a plugin that sends websocket requests to the K8s game API.
 */

(function () {
  'use strict';
  const wrapTextLength = 55;
  const PORTAL_STORAGE_KEYS = [
    'k8s-student-portal-state-v1',
    'k8s-exam-web-state-v1',
  ];
  const urlParams = new URLSearchParams(window.location.search);

  const loadPortalState = () => {
    for (const key of PORTAL_STORAGE_KEYS) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (error) {
        console.log(`[NpcK8sPluginCommand] failed to parse portal state ${key}`, {
          name: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error),
        });
      }
    }
    return {};
  };

  const portalState = loadPortalState();
  const wsUrl = urlParams.get('wsUrl') || portalState.gameWsUrl || '';
  const apiKey = urlParams.get('apiKey') || portalState.apiKey || '';
  const game = urlParams.get('game') || portalState.exerciseGame || portalState.game || '';
  let lastResponse = null;
  let callCount = 0;
  let pendingRequest = false; // Track if request is in flight
  let gameSocket = null;
  let gameSocketReady = false;
  let socketSubscribed = false;
  let queuedSocketAction = null;
  let lastInstructionSignature = null;

  const redactSensitiveValue = (key, value) => {
    switch (key) {
      case 'apiKey':
        return '[redacted-api-key]';
      case 'message':
      case 'task_description':
        return '[redacted-message]';
      case 'report_url':
      case 'easter_egg_url':
        return '[redacted-url]';
      default:
        return value;
    }
  };

  const sanitizeLogDetails = (details) => {
    if (typeof details === 'string') {
      try {
        return sanitizeLogDetails(JSON.parse(details));
      } catch (_error) {
        return details;
      }
    }
    if (Array.isArray(details)) {
      return details.map((entry) => sanitizeLogDetails(entry));
    }
    if (!details || typeof details !== 'object') {
      return details;
    }

    if (details instanceof Error) {
      return {
        name: details.name,
        message: details.message,
      };
    }

    const objectTag = Object.prototype.toString.call(details);
    if (objectTag !== '[object Object]') {
      const summary = {};
      if (typeof details.type === 'string') {
        summary.type = details.type;
      }
      if (typeof details.readyState === 'number') {
        summary.readyState = details.readyState;
      }
      if (typeof details.code === 'number') {
        summary.code = details.code;
      }
      if (typeof details.reason === 'string') {
        summary.reason = details.reason;
      }
      return Object.keys(summary).length > 0 ? summary : `[${objectTag}]`;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(details)) {
      if (value && typeof value === 'object') {
        const nestedTag = Object.prototype.toString.call(value);
        sanitized[key] = nestedTag === '[object Object]' || Array.isArray(value)
          ? sanitizeLogDetails(value)
          : `[${nestedTag}]`;
      } else {
        sanitized[key] = redactSensitiveValue(key, value);
      }
    }
    return sanitized;
  };

  const logSocket = (message, details) => {
    if (typeof details === 'undefined') {
      console.log(`[NpcK8sPluginCommand] ${message}`);
      return;
    }
    console.log(`[NpcK8sPluginCommand] ${message}`, sanitizeLogDetails(details));
  };

  const popitup = (url) => {
    let w = window.open(
      url,
      '_blank',
      'scrollbars=1,resizable=1,width=1000,height=800',
    );
    if (w == null || typeof w == 'undefined') {
      alert('Please allow popups for this site');
    }
    window.focus();
  };

  const popitup2 = (url1, url2) => {
    popitup(url1);
    popitup(url2);
  };

  // Display the text response within the window limits
  const wrapText = (text) => {
    const words = text.split(' ');
    let wrappedText = '';
    let currentLine = '';

    for (const word of words) {
      const potentialLine = currentLine + (currentLine ? ' ' : '') + word;
      if (potentialLine.length <= wrapTextLength) {
        currentLine = potentialLine;
      } else {
        wrappedText += (wrappedText ? '\n' : '') + currentLine;
        currentLine = word;
      }
    }

    if (currentLine) {
      wrappedText += (wrappedText ? '\n' : '') + currentLine;
    }

    return wrappedText;
  };

  const joinSentences = (parts) =>
    parts
      .filter(Boolean)
      .map((part) => String(part).trim())
      .join(' ');

  const buildDisplayMessage = (json) => {
    const instructionText =
      json.task_description && json.task_description !== json.message
        ? json.task_description
        : '';

    switch (json.status) {
      case 'STARTED':
      case 'RUNNING':
        return instructionText || json.message || '';
      case 'FAILED':
        if (instructionText) {
          return joinSentences(['No mark yet.', instructionText, 'Try again.']);
        }
        return json.message || 'No mark yet. Try again.';
      case 'OK':
        if (instructionText) {
          return instructionText;
        }
        return json.message || '';
      case 'ERROR':
        return json.message || '';
      default:
        return json.message || instructionText || '';
    }
  };

  const handleGamePayload = (json) => {
    logSocket('received payload', json);
    const nonTerminalStatuses = ['QUEUED', 'RUNNING'];
    if (nonTerminalStatuses.includes(json.status)) {
      pendingRequest = true;
      callCount = 1;
    } else {
      callCount = 0;
      pendingRequest = false;
      queuedSocketAction = null;
    }
    if (json.status !== 'OK' && json.report_url) {
      if (json.report_url && json.easter_egg_url)
        popitup2(json.easter_egg_url, json.report_url);
      else if (json.report_url) popitup(json.report_url);
    }
    const displayMessage = buildDisplayMessage(json);
    const displaySignature = displayMessage
      ? `${json.task_id || ''}:${json.current_phase || ''}:${json.status || ''}:${displayMessage}`
      : null;
    const shouldAlwaysDisplay = json.status === 'ERROR';
    if (displayMessage && (shouldAlwaysDisplay || displaySignature !== lastInstructionSignature)) {
      $gameMessage.add(wrapText(displayMessage));
      lastInstructionSignature = shouldAlwaysDisplay ? null : displaySignature;
    }
    if (json.next_game_phrase || nonTerminalStatuses.includes(json.status)) {
      lastResponse = json;
    }
    if (json.status === 'OK' || json.status === 'STARTED' || json.status === 'COMPLETED' || json.status === 'FAILED' || json.status === 'ABANDONED') {
      if (!displayMessage) {
        lastInstructionSignature = null;
      }
      if (json.easter_egg_url && json.status === 'OK') popitup(json.easter_egg_url);
      lastResponse = json;
    }
  };

  const showSocketRequiredMessage = (message) => {
    callCount = 0;
    pendingRequest = false;
    queuedSocketAction = null;
    $gameMessage.add(wrapText(message));
  };

  const subscribeSocket = () => {
    if (!gameSocketReady || socketSubscribed || !gameSocket) {
      return;
    }
    logSocket('sending subscribe', { game });
    gameSocket.send(
      JSON.stringify({
        action: 'subscribe',
        apiKey,
        game,
      }),
    );
    socketSubscribed = true;
  };

  const flushQueuedSocketAction = () => {
    if (!gameSocketReady || !gameSocket || !queuedSocketAction) {
      return;
    }
    logSocket('flushing queued action', queuedSocketAction.payload);
    gameSocket.send(JSON.stringify(queuedSocketAction.payload));
    queuedSocketAction = null;
  };

  const connectGameSocket = () => {
    if (!wsUrl || typeof WebSocket === 'undefined') {
      logSocket('wsUrl missing or WebSocket unsupported', {
        hasWsUrl: Boolean(wsUrl),
        hasWebSocketApi: typeof WebSocket !== 'undefined',
      });
      return false;
    }
    if (
      gameSocket &&
      (gameSocket.readyState === WebSocket.OPEN ||
        gameSocket.readyState === WebSocket.CONNECTING)
    ) {
      return true;
    }

    try {
      logSocket('opening websocket', { wsUrl });
      gameSocket = new WebSocket(wsUrl);
    } catch (error) {
      logSocket('websocket constructor failed', error);
      gameSocket = null;
      gameSocketReady = false;
      socketSubscribed = false;
      return false;
    }

    gameSocket.onopen = () => {
      logSocket('websocket open');
      gameSocketReady = true;
      socketSubscribed = false;
      subscribeSocket();
      flushQueuedSocketAction();
    };

    gameSocket.onmessage = (event) => {
      try {
        logSocket('websocket raw message', event.data);
        const payload = JSON.parse(event.data);
        if (payload?.type === 'game_status' && payload.data) {
          handleGamePayload(payload.data);
        }
      } catch (error) {
        logSocket('invalid websocket payload', error);
      }
    };

    gameSocket.onerror = (event) => {
      logSocket('websocket error', event);
      gameSocketReady = false;
      socketSubscribed = false;
    };

    gameSocket.onclose = (event) => {
      logSocket('websocket close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      gameSocketReady = false;
      socketSubscribed = false;
      gameSocket = null;
      if (pendingRequest) {
        showSocketRequiredMessage(
          'Sorry, the game websocket is disconnected. Please refresh and try again.',
        );
      }
    };

    return true;
  };

  const callApi = (npcName) => {
    if (callCount == 0) {
      $gameMessage.add('Hello!');
    }
    if (callCount > 0 || pendingRequest) {
      let message = 'I am working on it now!';
      if (lastResponse?.next_game_phrase) {
        switch (lastResponse?.next_game_phrase) {
          case 'SETUP':
            message = 'I am setting up it for you!';
            break;
          case 'READY':
            message = 'I am making sure it is ready for the challenge!';
            break;
          case 'CHALLENGE':
            message = 'I am running the challenge now!';
            break;
          case 'CHECK':
            message = 'I am checking the game now!';
            break;
        }
      }
      $gameMessage.add(message);
      return;
    }

    callCount++;
    pendingRequest = true;
    lastInstructionSignature = null;

    if (!wsUrl) {
      showSocketRequiredMessage(
        'This game now requires wsUrl in the page link before you can talk to NPCs.',
      );
      return;
    }

    if (!connectGameSocket() || !gameSocket) {
      showSocketRequiredMessage(
        'Sorry, I cannot connect to the game websocket server right now.',
      );
      return;
    }

    const payload = {
      action: 'talk',
      apiKey,
      game,
      npc: npcName,
    };
    if (gameSocket.readyState === WebSocket.OPEN) {
      logSocket('sending talk', payload);
      gameSocket.send(JSON.stringify(payload));
    } else {
      queuedSocketAction = { payload, npcName };
      logSocket('queueing talk until websocket opens', payload);
      $gameMessage.add('Connecting to the game websocket server...');
    }
  };

  if (wsUrl) {
    connectGameSocket();
  } else {
    console.log('NpcK8sPluginCommand requires wsUrl to use websocket transport.');
  }

  const _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'NpcK8sPluginCommand') {
      const npcName = args[0];
      console.log('NpcK8sPluginCommand Called by ' + npcName);
      callApi(npcName);
      return;
    }
  };
})();
