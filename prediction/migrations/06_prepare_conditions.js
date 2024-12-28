const deployConfig = require('./utils/deployConfig')(artifacts)
const ConditionalTokens = artifacts.require('ConditionalTokens')

module.exports = function (deployer) {
  deployer.then(async () => {
    const MAX_OUTCOMES = 8
    const pmSystem = await ConditionalTokens.deployed()
    const markets = require('../markets.config')
    for (const { questionId } of markets) {
      await pmSystem.prepareCondition(deployConfig.oracle, questionId, MAX_OUTCOMES)
    }
  })
}
