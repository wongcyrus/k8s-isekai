/*:
 * @plugindesc K8s API plugin for RPG Maker MV/MZ
 * @author Cyrus Wong
 *
 * @help This is a  plugin that send ajax request to K8s game api.
 */

(function () {
  // Your code goes here

  var _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'K8sApiPluginCommand') {
      console.log('K8sApiPluginCommand Called');
      $gameMessage.add('K8sApiPluginCommand \n<\N[ID]> \n<\V[ID]>');
    }
  };
})();
