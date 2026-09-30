import db from "./db";
import { initializeCoreSchema } from "./core";

initializeCoreSchema(db);
console.info("Cocowheels database ready.");
db.close();
