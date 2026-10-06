import assert from "node:assert/strict";
import test from "node:test";
import { assertRuntimeConfiguration } from "../server/index";

const productionEnvironment = {
  NODE_ENV: "production",
  COCOWHEELS_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  COCOWHEELS_DB_PATH: "/tmp/cocowheels-test.db",
  COCOWHEELS_FRONTEND_ORIGINS: "https://cocowheels.example",
  COCOWHEELS_PUBLIC_ORIGIN: "https://cocowheels.example",
};

test("production runtime rejects an incomplete secret configuration before listening", () => {
  assert.throws(
    () =>
      assertRuntimeConfiguration({
        ...productionEnvironment,
        COCOWHEELS_CODE_ENCRYPTION_KEY: "",
      }),
    /COCOWHEELS_CODE_ENCRYPTION_KEY_REQUIRED/,
  );
  assert.throws(
    () =>
      assertRuntimeConfiguration({
        ...productionEnvironment,
        COCOWHEELS_CODE_ENCRYPTION_KEY: "not-a-32-byte-key",
      }),
    /INVALID_CODE_ENCRYPTION_KEY/,
  );
});

test("production runtime accepts Cocowheels' complete isolated configuration", () => {
  assert.doesNotThrow(() => assertRuntimeConfiguration(productionEnvironment));
});
