import { Game } from "./game.model.js";
import { Subscriber } from "./subscriber.model.js";
import { Admin } from "./admin.model.js";
import { Usermobile } from "./usermobile.model.js";


Game.hasMany(Subscriber, { foreignKey: "game_id", as: "subscribers" });
Subscriber.belongsTo(Game, { foreignKey: "game_id", as: "game" });

export { Admin, Game, Subscriber, Usermobile };
