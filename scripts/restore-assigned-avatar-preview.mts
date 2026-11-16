// Explicit operator-only backfill from an approved local result; no provider/network calls.
import { mkdir, readFile, chmod, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { prepareAvatarRenditions } from '../server/map-avatars';
import { restoreAssignedAvatarPreview } from '../server/avatar-preview-recovery';
const args=process.argv.slice(2);
if (args.length!==2 || args[1]!=='--apply') throw new Error('Usage: node --import tsx scripts/restore-assigned-avatar-preview.mts APPROVED_RENDER --apply');
const assets=await prepareAvatarRenditions(await readFile(args[0]));
const config=parseEnv(await readFile('.env','utf8'));
const db=new Database(process.env.COCOWHEELS_DB_PATH || config.COCOWHEELS_DB_PATH || 'data/cocowheels.db',{fileMustExist:true});
db.pragma('foreign_keys=ON');
function idle() {
  if(db.prepare("SELECT 1 FROM rides WHERE status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE') LIMIT 1").get() || db.prepare("SELECT 1 FROM avatar_jobs WHERE status IN ('CHECKING','SUBMITTING','GENERATING') LIMIT 1").get()) throw new Error('RECOVERY_REQUIRES_IDLE_SERVICE');
}
try {
  idle();
  const targets=db.prepare('SELECT principal_id FROM account_map_avatars WHERE preview IS NULL AND sprite=?').all(assets.sprite) as {principal_id:string}[];
  if(targets.length!==1)throw new Error('NO_UNIQUE_LEGACY_AVATAR_MATCH');
  const folder='data/backups/assigned-preview-'+new Date().toISOString().replace(/[:.]/g,'-');
  await mkdir(folder,{recursive:true,mode:0o700});await db.backup(folder+'/database.sqlite');await chmod(folder+'/database.sqlite',0o600);
  idle();restoreAssignedAvatarPreview(db,targets[0].principal_id,assets.sprite,assets);
  const info=await sharp(assets.preview).metadata();
  const report={restored:1,preview:{width:info.width,height:info.height,bytes:assets.preview.length},mapLightBytes:assets.sprite.length,mapDetailBytes:assets.detail.length,paidTasksCreated:0,preferencesChanged:false,lifecycleChanged:false};
  await writeFile(folder+'/result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
} finally {db.close();}
