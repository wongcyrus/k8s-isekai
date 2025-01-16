/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a  plugin that send ajax request to K8s game api.
 */

(function () {
  'use strict';
  let count = 0;
  // Your code goes here
  let callApi = function () {
    let url =
      'https://4kig7tlso0.execute-api.us-east-1.amazonaws.com/Prod/game-task?email=cywong@vtc.edu.hk&game=game01';
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        let json = JSON.parse(xhr.response);
        console.log(json);
        count++;
        console.log('count: ' + count);
        $gameMessage.add(json.message);
      }
    };
    xhr.send();
  };

  var _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'K8sApiPluginCommand') {
      console.log('K8sApiPluginCommand Called');
      callApi();
    }
  };
})();
