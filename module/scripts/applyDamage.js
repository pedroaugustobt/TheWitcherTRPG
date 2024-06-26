import { buttonDialog } from "./chat.js";
import { getInteractActor } from "./helper.js";

export function addDamageMessageContextOptions(html, options) {
  let canApplyDamage = li => li.find(".damage-message").length
  let canApplyVcDamage = li => li.find(".verbalcombat-damage-message").length
  options.push(
    {
      name: `${game.i18n.localize("WITCHER.Context.applyDmg")}`,
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApplyDamage,
      callback: li => {
        ApplyNormalDamage(
          getInteractActor(),
          li.find(".dice-total")[0].innerText,
          li[0].dataset.messageId
        )
      }
    },
    {
      name: `${game.i18n.localize("WITCHER.Context.applyNonLethal")}`,
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApplyDamage,
      callback: li => {
        ApplyNonLethalDamage(
          getInteractActor(),
          li.find(".dice-total")[0].innerText,
          li[0].dataset.messageId
        )
      }
    }
  );
  return options;
}

async function ApplyNormalDamage(actor, totalDamage, messageId) {
  applyDamage(actor, totalDamage, messageId, "hp")
}

async function ApplyNonLethalDamage(actor, totalDamage, messageId) {
  applyDamage(actor, totalDamage, messageId, "sta")
}

async function applyDamage(actor, totalDamage, messageId, derivedStat) {
  let damageOptions = game.messages.get(messageId).getFlag('TheWitcherTRPG', 'damageOptions')
  let damage = game.messages.get(messageId).getFlag('TheWitcherTRPG', 'damage')
  let armors = actor.getList("armor").filter(a => a.system.equipped);

  let headArmors = armors.filter(h => h.system.location == "Head" || h.system.location == "FullCover")
  let torsoArmors = armors.filter(t => t.system.location == "Torso" || t.system.location == "FullCover")
  let legArmors = armors.filter(l => l.system.location == "Leg" || l.system.location == "FullCover")

  let naturalArmors = armors.filter(n => n.system.type == "Natural")

  const locationOptions = `
    <option value="Empty"></option>
    <option value="head"> ${game.i18n.localize("WITCHER.Dialog.attackHead")} </option>
    <option value="torso"> ${game.i18n.localize("WITCHER.Dialog.attackTorso")} </option>
    <option value="leftArm"> ${game.i18n.localize("WITCHER.Dialog.attackLArm")} </option>
    <option value="rightArm"> ${game.i18n.localize("WITCHER.Dialog.attackRArm")} </option>
    <option value="leftLeg"> ${game.i18n.localize("WITCHER.Dialog.attackLLeg")} </option>
    <option value="rightLeg"> ${game.i18n.localize("WITCHER.Dialog.attackRLeg")} </option>
    <option value="tailWing"> ${game.i18n.localize("WITCHER.Dialog.attackTail")} </option>
    `;

  const silverOptions = `
    <option></option>
    <option value="1d6">1d6</option>
    <option value="2d6">2d6</option>
    <option value="3d6">3d6</option>
    <option value="4d6">4d6</option>
    <option value="5d6">5d6</option>
    `;

  let location = damage.location;
  let damageTypeloc = `WITCHER.Armor.${damage.type}`;
  let content = `<label>${game.i18n.localize("WITCHER.Damage.damageType")}: <b>${game.i18n.localize(damageTypeloc)}</b></label> <br />
      <label>${game.i18n.localize("WITCHER.Damage.CurrentLocation")}: <b>${location.alias}</b></label> <br />
      <label>${game.i18n.localize("WITCHER.Damage.ChangeLocation")}: <select name="changeLocation">${locationOptions}</select></label> <br />`

  if (actor.type == "monster") {
    content += `<label>${game.i18n.localize("WITCHER.Damage.resistSilver")}: <input type="checkbox" name="resistNonSilver"></label><br />
                    <label>${game.i18n.localize("WITCHER.Damage.resistMeteorite")}: <input type="checkbox" name="resistNonMeteorite"></label><br />`
  }

  content += `<label>${game.i18n.localize("WITCHER.Damage.isVulnerable")}: <input type="checkbox" name="vulnerable"></label><br />
    <label>${game.i18n.localize("WITCHER.Damage.oilDmg")}: <input type="checkbox" name="oilDmg"></label><br />
    <label>${game.i18n.localize("WITCHER.Damage.silverDmg")}: <select name="silverDmg">${silverOptions}</select></label><br />`

  let cancel = true;
  let resistSilver = false;
  let resistMeteorite = false;
  let newLocation = false;
  let isVulnerable = false;
  let addOilDmg = false;
  let silverDmg;

  let infoTotalDmg = totalDamage

  let dialogData = {
    buttons: [
      [`${game.i18n.localize("WITCHER.Button.Continue")}`,
      (html) => {
        newLocation = html.find("[name=changeLocation]")[0].value;
        resistSilver = html.find("[name=resistNonSilver]").prop("checked");
        resistMeteorite = html.find("[name=resistNonMeteorite]").prop("checked");
        isVulnerable = html.find("[name=vulnerable]").prop("checked");
        addOilDmg = html.find("[name=oilDmg]").prop("checked");
        silverDmg = html.find("[name=silverDmg]")[0].value;
        cancel = false
      }]],
    title: game.i18n.localize("WITCHER.Context.applyDmg"),
    content: content
  }

  await buttonDialog(dialogData)

  if (cancel) {
    return
  }

  if (silverDmg) {
    let silverRoll = await new Roll(silverDmg).evaluate({ async: true })
    totalDamage = Number(totalDamage) + silverRoll.total
    infoTotalDmg += `+${silverRoll.total}[${game.i18n.localize("WITCHER.Damage.silver")}]`
  }

  if (newLocation != "Empty") {
    location = actor.getLocationObject(newLocation);
  }

  if (addOilDmg) {
    totalDamage = Number(totalDamage) + 5
    infoTotalDmg += `+5[${game.i18n.localize("WITCHER.Damage.oil")}]`
  }

  let shield = actor.system.derivedStats.shield.value;
  if (totalDamage < shield) {
    actor.update({ 'system.derivedStats.shield.value': shield - totalDamage });
    let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span><br />
    ${game.i18n.localize("WITCHER.Damage.shield")}: <span class="error-display">${shield}</span><br />
    ${game.i18n.localize("WITCHER.Damage.ToMuchShield")}
    `;
    let messageData = {
      user: game.user.id,
      content: messageContent,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: actor.getNoDamageFlags(),
    }
    ChatMessage.create(messageData);
    return;
  }
  else {
    actor.update({ 'system.derivedStats.shield.value': 0 });
    totalDamage -= shield;
  }

  let armorSet = {};
  let totalSP = 0
  let displaySP = ""
  let values;

  console.log(location.name)
  //todo refactor
  switch (location.name) {
    case "head":
      armorSet = getArmors(headArmors)
      values = getArmorSp(armorSet, "headStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "torso":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "torsoStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "rightArm":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "rightArmStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "leftArm":
      armorSet = getArmors(torsoArmors)
      values = getArmorSp(armorSet, "leftArmStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "rightLeg":
      armorSet = getArmors(legArmors)
      values = getArmorSp(armorSet, "rightLegStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
    case "leftLeg":
      armorSet = getArmors(legArmors)
      values = getArmorSp(armorSet, "leftLegStopping")
      displaySP = values[0]
      totalSP = values[1]
      break;
  }

  if (actor.type == "monster") {
    //todo refactor
    switch (location.name) {
      case "head":
        totalSP += actor.system.armorHead;
        displaySP += actor.system.armorHead;
        break;
      case "torso":
      case "rightArm":
      case "leftArm":
        totalSP += actor.system.armorUpper;
        displaySP += actor.system.armorUpper;
        break;
      case "rightLeg":
      case "leftLeg":
        totalSP += actor.system.armorLower;
        displaySP += actor.system.armorLower;
        break;
      case "tailWing":
        totalSP += actor.system.armorTailWing;
        displaySP += actor.system.armorTailWing;
        break;
    }
  }

  naturalArmors.forEach(armor => {
    //todo refactor
    switch (location.name) {
      case "head": totalSP = Number(totalSP) + Number(armor?.system.headStopping); displaySP += `+${armor?.system.headStopping}`; break;
      case "torso": totalSP = Number(totalSP) + Number(armor?.system.torsoStopping); displaySP += `+${armor?.system.torsoStopping}`; break;
      case "rightArm": totalSP = Number(totalSP) + Number(armor?.system.rightArmStopping); displaySP += `+${armor?.system.rightArmStopping}`; break;
      case "leftArm": totalSP = Number(totalSP) + Number(armor?.system.leftArmStopping); displaySP += `+${armor?.system.leftArmStopping}`; break;
      case "rightLeg": totalSP = Number(totalSP) + Number(armor?.system.rightLegStopping); displaySP += `+${armor?.system.rightLegStopping}`; break;
      case "leftLeg": totalSP = Number(totalSP) + Number(armor?.system.leftLegStopping); displaySP += `+${armor?.system.leftLegStopping}`; break;
    }
    displaySP += `[${game.i18n.localize("WITCHER.Armor.Natural")}]`;
  })

  if (damageOptions.improvedArmorPiercing) {
    totalSP = totalSP / 2;
    displaySP = displaySP / 2;
  }

  totalDamage -= totalSP < 0 ? 0 : totalSP;

  let infoAfterSPReduction = totalDamage < 0 ? 0 : totalDamage

  if (totalDamage <= 0) {
    let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span><br />
        ${game.i18n.localize("WITCHER.Damage.totalSP")}: <span class="error-display">${displaySP}</span><br />
        ${game.i18n.localize("WITCHER.Damage.afterSPReduct")} <span class="error-display">${infoAfterSPReduction}</span><br /><br />
        ${game.i18n.localize("WITCHER.Damage.NotEnough")}
        `;
    let messageData = {
      user: game.user.id,
      content: messageContent,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: actor.getNoDamageFlags(),
    }
    let rollResult = await new Roll("1").evaluate({ async: true })
    rollResult.toMessage(messageData)
    return
  }

  totalDamage *= location.locationFormula
  let infoAfterLocation = totalDamage

  let ignoreArmorResistance = damageOptions.armorPiercing || damageOptions.improvedArmorPiercing;
  if (!ignoreArmorResistance && (armorSet["lightArmor"]?.system[damage.type] || armorSet["mediumArmor"]?.system[damage.type] || armorSet["heavyArmor"]?.system[damage.type] || naturalArmors.find(armor => armor.system[damage.type]))) {
    totalDamage *= 0.5
  }

  if (resistSilver || resistMeteorite) {
    totalDamage *= 0.5
  }
  if (isVulnerable) {
    totalDamage *= 2
  }
  let infoAfterResistance = totalDamage

  let spDamage = damageOptions.crushingForce || damageOptions.ablating 
    ? Math.floor((await new Roll("1d6/2+1").evaluate()).total) 
    : 1
    
  if(damageOptions.crushingForce) {
    spDamage *= 2
  }

  //todo refactor
  switch (location.name) {
    case "head":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.headStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.headStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.headStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.headStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.headStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.headStopping': heavyArmorSP })
      }
      break;
    case "torso":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.torsoStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.torsoStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.torsoStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.torsoStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.torsoStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.torsoStopping': heavyArmorSP })
      }
      break;
    case "rightArm":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.rightArmStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.rightArmStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.rightArmStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.rightArmStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.rightArmStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.rightArmStopping': heavyArmorSP })
      }
      break;
    case "leftArm":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.leftArmStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.leftArmStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.leftArmStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.leftArmStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.leftArmStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.leftArmStopping': heavyArmorSP })
      }
      break;
    case "rightLeg":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.rightLegStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.rightLegStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.rightLegStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.rightLegStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.rightLegStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.rightLegStopping': heavyArmorSP })
      }
      break;
    case "leftLeg":
      if (armorSet["lightArmor"]) {
        let lightArmorSP = armorSet["lightArmor"].system.leftLegStopping - spDamage;
        if (lightArmorSP < 0) {
          lightArmorSP = 0
        }
        armorSet["lightArmor"].update({ 'system.leftLegStopping': lightArmorSP })
      }
      if (armorSet["mediumArmor"]) {
        let mediumArmorSP = armorSet["mediumArmor"].system.leftLegStopping - spDamage;
        if (mediumArmorSP < 0) {
          mediumArmorSP = 0
        }
        armorSet["mediumArmor"].update({ 'system.leftLegStopping': mediumArmorSP })
      }
      if (armorSet["heavyArmor"]) {
        let heavyArmorSP = armorSet["heavyArmor"].system.leftLegStopping - spDamage;
        if (heavyArmorSP < 0) {
          heavyArmorSP = 0
        }
        armorSet["heavyArmor"].update({ 'system.leftLegStopping': heavyArmorSP })
      }
      break;
  }

  let messageContent = `${game.i18n.localize("WITCHER.Damage.initial")}: <span class="error-display">${infoTotalDmg}</span> <br />
    ${game.i18n.localize("WITCHER.Damage.totalSP")}: <span class="error-display">${displaySP} ${damageOptions.improvedArmorPiercing ? game.i18n.localize("WITCHER.Damage.improvedArmorPiercing") : ''}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterSPReduct")}: <span class="error-display">${infoAfterSPReduction} ${(damageOptions.improvedArmorPiercing || damageOptions.armorPiercing) ? game.i18n.localize("WITCHER.Damage.armorPiercing") : ''}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterLocationModifier")}: <span class="error-display">${infoAfterLocation}</span><br />
    ${game.i18n.localize("WITCHER.Damage.afterResistances")}: <span class="error-display">${infoAfterResistance}</span><br /><br />
    ${game.i18n.localize("WITCHER.Damage.totalApplied")}: <span class="error-display">${Math.floor(totalDamage)}</span>
    `;
  if (damageOptions.ablating) {
    messageContent += `<br/>${game.i18n.localize("WITCHER.Damage.ablated")}: <span class="error-display">${spDamage}</span>`
  }

  if (damageOptions.crushingForce) {
    messageContent += `<br/>${game.i18n.localize("WITCHER.Damage.crushingForce")}: <span class="error-display">${spDamage}</span>`
  }

  let messageData = {
    user: game.user.id,
    content: messageContent,
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flags: actor.getDamageFlags(),
  }
  let rollResult = await new Roll("1").evaluate({ async: true })
  rollResult.toMessage(messageData)

  actor?.update({
    [`system.derivedStats.${derivedStat}.value`]: actor.system.derivedStats[derivedStat].value - Math.floor(totalDamage)
  });
}

function getArmors(armors) {
  let lightCount = 0, mediumCount = 0, heavyCount = 0;
  let lightArmor, mediumArmor, heavyArmor;
  armors.forEach(item => {
    if (item.system.type == "Light") {
      lightCount++;
      lightArmor = item
    }
    if (item.system.type == "Medium") {
      mediumCount++;
      mediumArmor = item
    }
    if (item.system.type == "Heavy") {
      heavyCount++;
      heavyArmor = item
    }
  });
  if (lightCount > 1 || mediumCount > 1 || heavyCount > 1) {
    ui.notifications.error(game.i18n.localize("WITCHER.Armor.tooMuch"))
    return
  }
  return {
    lightArmor: lightArmor,
    mediumArmor: mediumArmor,
    heavyArmor: heavyArmor
  };
}

function getArmorSp(armorSet, location) {
  return getStackedArmorSp(armorSet["lightArmor"]?.system[location], armorSet["mediumArmor"]?.system[location], armorSet["heavyArmor"]?.system[location])
}

function getStackedArmorSp(lightArmorSP, mediumArmorSP, heavyArmorSP) {
  let totalSP = 0
  let displaySP = ""

  if (heavyArmorSP) {
    totalSP = heavyArmorSP
    displaySP = heavyArmorSP
  }

  if (mediumArmorSP) {
    if (heavyArmorSP) {
      let diff = getArmorDiffBonus(heavyArmorSP, mediumArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += "+" + diff
    }
    else {
      displaySP = mediumArmorSP
      totalSP = mediumArmorSP
    }
  }

  if (lightArmorSP) {
    if (mediumArmorSP) {
      let diff = getArmorDiffBonus(mediumArmorSP, lightArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += `+${diff}[${game.i18n.localize("WITCHER.Armor.LayerBonus")}]`
    }
    else if (heavyArmorSP) {
      let diff = getArmorDiffBonus(heavyArmorSP, lightArmorSP)
      totalSP = Number(totalSP) + Number(diff)
      displaySP += `+${diff}[${game.i18n.localize("WITCHER.Armor.LayerBonus")}]`
    }
    else {
      totalSP = lightArmorSP
      displaySP = lightArmorSP
    }
  }
  return [displaySP, totalSP]
}

function getArmorDiffBonus(OverArmor, UnderArmor) {
  let diff = OverArmor - UnderArmor

  if (UnderArmor <= 0 || OverArmor <= 0) {
    return 0
  }

  if (diff < 0) { diff *= -1 }

  if (diff > 20) {
    return 0
  } else if (diff > 15) {
    return 2
  } else if (diff > 9) {
    return 3
  } else if (diff > 5) {
    return 4
  } else if (diff >= 0) {
    return 5
  }
  return 0

}

export { ApplyNormalDamage, ApplyNonLethalDamage };