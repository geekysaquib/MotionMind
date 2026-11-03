// Jest can't `require()` ES-module-only packages, and Fastify's test helper (light-my-request)
// requires `cookie` v2, which is ESM-only. It only uses stringifySetCookie, and only when a test
// passes `cookies` to app.inject(). This stand-in covers that case for name=value cookies.
'use strict';

function stringifySetCookie({ name, value }) {
  return `${name}=${encodeURIComponent(value)}`;
}

module.exports = { stringifySetCookie };
