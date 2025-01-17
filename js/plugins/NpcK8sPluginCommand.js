/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a  plugin that send ajax request to K8s game api.
 */

(function () {
  'use strict';
  const baseUrl = 'https://4kig7tlso0.execute-api.us-east-1.amazonaws.com/Prod';
  const email = 'cywong@vtc.edu.hk';
  const game = 'game01';

  let currentTask = '';
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
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        isCalling = false;
        if (xhr.status === 200) {
          let json = JSON.parse(xhr.response);
          console.log(json);
          if (json.game_phrase === 'SETUP' && json.status === 'OK') {
            currentTask = json.message;
            gameMessage.add(currentTask);

            if (json.status !== 'OK') {
              popitup(json.report_url);
            }

            lastResponse = json;
          }
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
