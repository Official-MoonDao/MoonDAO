/// ######## BANNER WITH FIXES START ########

// ---- DYNAMIC_REQUIRE_FS_FIX ----
var require = (await import("node:module")).createRequire(import.meta.url);
var __filename = (await import("node:url")).fileURLToPath(import.meta.url);
var __dirname = (await import("node:path")).dirname(__filename);
// ---- DYNAMIC_REQUIRE_FS_FIX ----

/// ######## BANNER WITH FIXES END ########

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// wallet-setup/basic.setup.ts
import { defineWalletSetup } from "@synthetixio/synpress";
import { MetaMask } from "@synthetixio/synpress/playwright";
var SEED_PHRASE = "test test test test test test test test test test test junk";
var PASSWORD = "Tester@1234";
var basic_setup_default = defineWalletSetup(PASSWORD, (context, walletPage) => __async(void 0, null, function* () {
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  yield metamask.importWallet(SEED_PHRASE);
}));
export {
  basic_setup_default as default
};
