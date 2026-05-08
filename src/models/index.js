import { Game } from "./game.model.js";
import { Subscriber } from "./subscriber.model.js";
import { Admin } from "./admin.model.js";
import { Usermobile } from "./usermobile.model.js";
import { Role } from "./role.model.js";
import { Permission } from "./permission.model.js";
import { RolePermission } from "./rolePermission.model.js";
import { Reward } from "./reward.model.js";


Game.hasMany(Subscriber, { foreignKey: "game_id", as: "subscribers" });
Subscriber.belongsTo(Game, { foreignKey: "game_id", as: "game" });

Game.hasMany(Reward, { foreignKey: "game_id", sourceKey: "game_id", as: "rewards" });
Reward.belongsTo(Game, { foreignKey: "game_id", targetKey: "game_id", as: "game" });

Usermobile.belongsTo(Game, { foreignKey: "game_id", targetKey: "game_id", as: "game" });
Game.hasMany(Usermobile, { foreignKey: "game_id", sourceKey: "game_id", as: "usermobiles" });

Admin.belongsTo(Role, { foreignKey: "role_id", as: "rbacRole" });
Role.hasMany(Admin, { foreignKey: "role_id", as: "admins" });

Role.hasMany(RolePermission, { foreignKey: "role_id", as: "rolePermissions" });
RolePermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Permission.hasMany(RolePermission, { foreignKey: "permission_id", as: "rolePermissions" });
RolePermission.belongsTo(Permission, { foreignKey: "permission_id", as: "permission" });

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
});

export { Admin, Game, Permission, Reward, Role, RolePermission, Subscriber, Usermobile };
