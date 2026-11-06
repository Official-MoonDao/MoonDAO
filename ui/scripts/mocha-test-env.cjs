/**
 * Fallback public client id so modules that build a thirdweb client at import
 * time can load in unit tests. A real id already in the environment is kept.
 * This file must be required before any test module.
 */
if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = 'unit-test-client'
}
if (!process.env.NEXT_PUBLIC_TEST_ENV) {
  process.env.NEXT_PUBLIC_TEST_ENV = 'true'
}
