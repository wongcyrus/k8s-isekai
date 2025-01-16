//=============================================================================
// WeaponSkill.js
//=============================================================================

/*:
 * @plugindesc Change skill id of attack for each weapon.
 * @author Sasuke KANNAZUKI
 *
 * @help This plugin does not provide plugin commands.
 *
 * When <skill_id:3> is written in a weapon's note field, 
 * skill id # 3 is used for the weapon's attack.
 * If nothing is written, default id(=1) is used.
 *
 * Check Points:
 * - When multiple weapons are equipped, the skill id of the weapon
 *  held in the dominant hand (previously defined) is used.
 * - It is most favorable for "skill type" to be "none"(=0),
 *  otherwise you cannot attack when your skill is blocked.
 *
 * Usage examples of this plugin:
 * - to create all-range weapons
 * - to create dual-attack or triple-attack weapons
 * - If healing skill is set when actor attacks, you can choose a friend to heal.
 * - It is possible to make a weapon that functions similar to a guard command. 
 */

/*:ja
 * @plugindesc armsごとにNormal attackのスキルIDをChangeします。
 * @author Kannazukiサスケ
 *
 * @help このプラグインにはプラグインコマンドはありません。
 *
 *  armsの「メモ」barに、<skill_id:3> とBookいたoccasion、
 * Normal attackのinternational、3Fanのスキルがmovementします。
 * ※specialにdescribeがなければ、usually passり1Fanのスキルがadoptされます。
 *
 * チェックポイント:
 * - Er Dao Liuのoccasion、profitきwrist(Firstにdefinitionされたsquare)にholdっているスキルIDがadoptされます。
 * - スキルタイプは「なし」にするのがseeましいです。
 * さもなくば、technologyなどをseal upじられたとき、attackがcome outなくなります。
 *
 * Scenarioされるuse:
 * - All attacks possibleなarms
 * - 2return attack、3return attackするarms
 * - Recovery magicをスキルにSpecifyしたoccasion、
 * 「attack」をchooseんだinternational、Flavor recipeのchoose択がcome out、そのNakamaをReplyします
 * - defenseコマンドなどとEqualになるarmsもpossibleです。
 */

(function() {

  //
  // set skill id for attack.
  //
  Game_Actor.prototype.attackSkillId = function() {
    var normalId = Game_BattlerBase.prototype.attackSkillId.call(this);
    if(this.hasNoWeapons()){
      return normalId;
    }
    var weapon = this.weapons()[0];  // at plural weapon, one's first skill.
    var id = weapon.meta.skill_id;
    return id ? Number(id) : normalId;
  };

  //
  // for command at battle
  //
  var _Scene_Battle_commandAttack = Scene_Battle.prototype.commandAttack;
  Scene_Battle.prototype.commandAttack = function() {
    BattleManager.inputtingAction().setAttack();
    // normal attack weapon (or other single attack weapon)
    var action = BattleManager.inputtingAction();
    if(action.needsSelection() && action.isForOpponent()){
      _Scene_Battle_commandAttack.call(this);
      return;
    }
    // special skill weapon
    this.onSelectAction();
  };

})();

