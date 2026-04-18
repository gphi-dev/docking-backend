import { Game } from "./game.model.js";
import { Subscriber } from "./subscriber.model.js";
import { Admin } from "./admin.model.js";
import { Usermobile } from "./usermobile.model.js";


Game.hasMany(Subscriber, { foreignKey: "game_id", as: "subscribers" });
Subscriber.belongsTo(Game, { foreignKey: "game_id", as: "game" });

Usermobile.belongsTo(Game, { foreignKey: "game_id", targetKey: "game_id", as: "game" });
Game.hasMany(Usermobile, { foreignKey: "game_id", sourceKey: "game_id", as: "usermobiles" });

export { Admin, Game, Subscriber, Usermobile };
