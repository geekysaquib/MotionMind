// jsdom plus the modern globals Node already has (fetch, Response, crypto.randomUUID, ...),
// which plain jest-environment-jsdom leaves out. The web app relies on all of them in real browsers.
'use strict';

const { TestEnvironment } = require('jest-environment-jsdom');

class BrowserLikeEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    const g = this.global;
    for (const name of ['fetch', 'Request', 'Response', 'Headers', 'FormData', 'Blob', 'TextEncoder', 'TextDecoder', 'structuredClone', 'AbortSignal', 'AbortController']) {
      if (globalThis[name]) g[name] = globalThis[name];
    }
    Object.defineProperty(g, 'crypto', { value: globalThis.crypto, configurable: true });
  }
}

module.exports = BrowserLikeEnvironment;
