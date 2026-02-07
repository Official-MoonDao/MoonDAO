/**
 * Setup for running Cypress unit specs (describe/it/expect) with Mocha in Node.
 * Cypress unit specs use Chai's expect; this exposes it globally so the same spec file runs without Cypress binary.
 */
const { expect } = require('chai')
global.expect = expect
