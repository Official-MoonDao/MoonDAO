# MoonDAO Retroactive Rewards

## Quarterly checklist

0. First day of the quarter, open /projects and log 'ethBudget' to get ETH portion of the retroactive rewards budget.
0. Open up a community circle on coordinape.
0. Open the project table on [arbiscan](https://arbiscan.io/address/0xCb31829B312923C7502766ef4f36948A7A64cD6A) and [tableland](https://studio.tableland.xyz/jaderiverstokes/prod/default/project).
0. Find the ids on tableland for any projects which concluded this quarter.
0. Use updateTableCol on arbiscan update eligible to 1, set the finalReportLink (eg. https://docs.google.com/document/d/...), and upfrontPayments (eg. {"0xabcd...0123" :10,"0xefga...4567":5,"vMOONEY": {"0xabcd...0123":10000,"0xefga...4567":20000}}) based on the final report accounting.
0. Go to ui/lib/utils/dates.ts and make sure isRewardsCycle returns true to go live on voting.
0. Publicize the link for people to submit projects votes (moondao.com/projects), and collect votes for community circle.
0. Update the object for community cirle in ui/components/nance/ProjectRewards.tsx:260 (eg. {"0xabcd...0123":20,"0xefga...4567":80}
0. After voting is finished, open /projects and log projectIdToEstimatedPercentage, humanFormat to view project percentages and contributor payouts respectively.
0. Log ethPayoutCSV and use result to pay out ETH rewards using CSV Airdrop app on the treasury safe.
0. Log mooneyBudget, vMooneyAddresses and vMooneyAmounts for paying out vMOONEY rewards.
0. Connect the [MOONEY](https://arbiscan.io/address/0x1Fa56414549BdccBB09916f61f0A5827f779a85c) contract to the treasury safe,, and approve the [VotingEscrowDepositor](https://arbiscan.io/address/0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0) contract to spend the MOONEY budget for the quarter.
0. Connect the [VotingEscrowDepositor](https://arbiscan.io/address/0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0) contract to the terasury safe, and call updateWithdrawAmounts with the address and amounts from vMooneyAddresses and vMooneyAmounts.
0. After payouts are complete, set active to 0 on the project table for the projects which are now complete.
0. On an ongoing basis, run `Pipelines/Integration/POST/Tableland/load_project.ts` to add new projects into the table.
