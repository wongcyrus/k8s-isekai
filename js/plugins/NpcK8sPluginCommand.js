/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a  plugin that send ajax request to K8s game api.
 */

(function () {
  'use strict';
  const urlParams = new URLSearchParams(window.location.search);
  const baseUrl = urlParams.get('baseUrl');
  const email = urlParams.get('email');
  const game = urlParams.get('game');
  let lastResponse = null;

  let isCalling = false;

  const popitup = (url) => {
    window.open(url, 'name', 'height=800,width=800');
    window.focus();
    return false;
  };
  const callApi = (gameMessage) => {
    if (isCalling) return;
    isCalling = true;

    let url = `${baseUrl}/game-task?email=${email}&game=${game}`;
    if (lastResponse?.next_game_phrase) {
      url = `${baseUrl}/grader?email=${email}&game=${game}&phrase=${lastResponse.next_game_phrase}`;
    }
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        isCalling = false;
        if (xhr.status === 200) {
          let json = JSON.parse(xhr.response);
          console.log(json);
          if (json.status !== 'OK') {
            popitup(json.report_url);
          }
          if (json.message) {
            gameMessage.add(json.message);
          }
          lastResponse = json;
        }
      }
    };
    xhr.send();
  };

  var _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'NpcK8sPluginCommand') {
      console.log('NpcK8sPluginCommand Called');
      callApi($gameMessage);
    }
  };
})();
