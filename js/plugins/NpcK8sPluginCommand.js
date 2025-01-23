/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a plugin that sends ajax requests to the K8s game API.
 */

(function () {
  'use strict';
  const wrapTextLength = 55;
  const urlParams = new URLSearchParams(window.location.search);
  const baseUrl = urlParams.get('baseUrl');
  const apiKey = urlParams.get('apiKey');
  const game = urlParams.get('game');
  let lastResponse = null;
  let callCount = 0;

  const popitup = (url) => {
    window.open(url, 'name', 'scrollbars=1,resizable=1,width=1000,height=800');
    window.focus();
    return false;
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

  const callApi = (npcName) => {
    if (callCount == 0) {
      $gameMessage.add('Hello!');
    }
    if (callCount > 0) {
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

    let url = `${baseUrl}/game-task?game=${game}&npcName=${npcName}`;
    if (lastResponse?.next_game_phrase) {
      url = `${baseUrl}/grader?game=${game}&phrase=${lastResponse.next_game_phrase}&npcName=${npcName}`;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('x-api-key', apiKey);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        callCount = 0;
        if (xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          console.log(json);
          if (json.status !== 'OK' && json.report_url) {
            popitup(json.report_url);
          }
          if (json.message) {
            $gameMessage.add(wrapText(json.message));
          }
          lastResponse = json;
        } else {
          $gameMessage.add('Sorry I cannot connect to the server!');
        }
      }
    };
    xhr.send();
  };

  const _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'NpcK8sPluginCommand') {
      const npcName = args[0];
      console.log('NpcK8sPluginCommand Called by ' + npcName);
      callApi(npcName);
    }
  };
})();
