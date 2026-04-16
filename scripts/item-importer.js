import {
  parseMultipleAbilities,
  preprocessRawAbilities
} from "./parsers/abilityParser.js";

import { preprocessStartingAbilities } from "./parsers/startingAbilityParser.js";

import { preprocessTreasureBlocks } from "./parsers/treasureParser.js";

import {
  parseLeveledTreasureBlock,
  parseMultipleLeveledTreasures
} from "./parsers/leveledTreasureParser.js";


export class ItemImporterApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "item-importer",
      title: "Draw Steel Item Importer",
      template: "modules/draw-steel-item-importer/templates/importer-ui.html",
      classes: ["draw-steel", "item-importer"],
      width: 500,
      height: "auto",
      resizable: true
    });
  }

  getData() {
    return {
      itemTypes: [
        "ability (only with cost like (3 Ferocity)",
        "ability without cost (starting)",
        "complication (not yet implemented)",
        "culture (not yet implemented)",
        "feature (not yet implemented)",
        "perk (not yet implemented)",
        "project (not yet implemented)",
        "title (not yet implemented)",
        "treasure"
      ]
    };
  }

  activateListeners(html) {
    console.log("ItemImporterApp listeners activated");

    const itemTypeSelect = html.find("#item-type");
    const treasureFields = html.find("#treasure-fields");
    const treasureCategorySelect = html.find("#treasure-category");
    const treasureEchelon = html.find("#treasure-echelon");
    const leveledSubtype = html.find("#leveled-subtype");

    if (itemTypeSelect.length && treasureFields.length) {
      itemTypeSelect.on("change", event => {
        const selected = event.target.value;
        treasureFields.toggle(selected === "treasure");
      });

      treasureFields.toggle(itemTypeSelect.val() === "treasure");
    } else {
      console.warn("⚠️ Treasure fields or item type selector not found in DOM.");
    }

    if (treasureCategorySelect.length && treasureEchelon.length && leveledSubtype.length) {
      treasureCategorySelect.on("change", event => {
        const selected = event.target.value;
        treasureEchelon.toggle(selected !== "leveled");
        leveledSubtype.toggle(selected === "leveled");
      });

      const initialCategory = treasureCategorySelect.val();
      treasureEchelon.toggle(initialCategory !== "leveled");
      leveledSubtype.toggle(initialCategory === "leveled");
    }

    html.find("#import-button").on("click", async () => {
      const type = itemTypeSelect.val();
      const rawText = html.find("#item-text").val()?.trim();
      const folderName = html.find("#folder-name").val()?.trim();

      const category = type === "treasure"
        ? treasureCategorySelect.val() || null
        : null;

      const echelon = type === "treasure" && category !== "leveled"
        ? parseInt(treasureEchelon.val(), 10)
        : null;

      const leveledType = type === "treasure" && category === "leveled"
        ? html.find("#leveled-type").val() || null
        : null;

      if (!type || !rawText) {
        ui.notifications.warn("Please select an item type and paste item text.");
        return;
      }

      let folderId = null;

      if (folderName) {
        const existingFolder = game.folders.find(
          f => f.name === folderName && f.type === "Item"
        );

        if (existingFolder) {
          folderId = existingFolder.id;
        } else {
          try {
            const newFolder = await Folder.create({
              name: folderName,
              type: "Item",
              parent: null,
              color: "#4b4a4a",
              sorting: "m"
            });
            folderId = newFolder.id;
          } catch (err) {
            console.error("Folder creation failed:", err);
            ui.notifications.error("Unable to create folder.");
            return;
          }
        }
      }

      let parsedItems = [];

      console.log(`🧭 Importer routing: selected type = "${type}"`);

      if (type === "ability (only with cost like (3 Ferocity)") {
        console.log("🔧 Using costed ability parser");
        const structuredItems = preprocessRawAbilities(rawText);
        parsedItems = parseMultipleAbilities(structuredItems);
      } else if (type === "ability without cost (starting)") {
        console.log("🌀 Using costless ability parser");
        parsedItems = preprocessStartingAbilities(rawText);
      } else if (type === "treasure") {
        if (category === "leveled") {
          parsedItems = parseMultipleLeveledTreasures(rawText, { leveledType, echelon });
        } else {
          parsedItems = preprocessTreasureBlocks(rawText, { category, echelon });
        }
      } else {
        console.warn(`⚠️ Unknown item type selected: "${type}"`);
        ui.notifications.warn(`${type} is not yet implemented.`);
        return;
      }

      for (const parsed of parsedItems) {
        if (!parsed || !parsed.name) continue;
        parsed.folder = folderId;

        try {
          await CONFIG.Item.documentClass.createDocuments([parsed]);
          ui.notifications.info(`Created ${type}: ${parsed.name}`);
        } catch (err) {
          console.error("Item creation failed:", err);
          ui.notifications.error(`Error creating item: ${parsed.name}`);
        }
      }

      this.close();
    });
  }
}

Hooks.on("renderItemDirectory", (app, html, data) => {
  const $html = $(html);
  const button = $(`
    <button class="item-importer-button">
      <i class="fas fa-download"></i> Import Draw Steel Item
    </button>
  `);

  button.click(() => new ItemImporterApp().render(true));
  $html.find(".directory-footer").append(button);
});