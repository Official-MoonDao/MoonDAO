> **Superseded.** This page is a 2023 write-up. The live formula is [Project System](/docs/Projects/Project-System) v8.0: 5% of liquid non-MOONEY assets **minus that quarter’s project budgets**, paid in USD-pegged stablecoins, plus the geometric $vMOONEY release. Members allocate rewards on [Projects](https://moondao.com/projects).

MoonDAO runs quarterly retroactive rewards every three months at the end of each quarter (Q1 is Jan to Mar, Q2 Apr to Jun, etc). As MoonDAO members and citizens of the Space Acceleration Network, we have the responsibility to review all the projects that were completed over the previous quarter and allocate retroactive rewards to the teams. This process aims to achieve a fair and meritocratic distribution of rewards.

## How are the total amount of rewards determined?

Each quarter, both MOONEY and ETH are distributed from the treasury toward completed projects and their contributors. The amount of ETH released is equal to 5% of the treasury’s total liquid non-MOONEY assets (like ETH, DAI, and other stables). The amount of MOONEY follows a geometric series where 95% of the amount released in the previous quarter will be distributed in the form of voting power staked for 4 years.

### Example

Throughout this document we’ll use examples from a previous quarter. In this case, the treasury held these liquid assets:

| ASSET | AMOUNT | EXCHANGE RATE | ETH Equivalent |
|-------|--------|---------------|----------------|
| ETH   | 482.38 | 1             | 482.38         |
| WETH  | 0.07   | 0.995         | 0.06           |
| DAI   | 8203.95| 0.0004291     | 3.52           |
| USDT  | 6811.63| 0.0004289     | 2.92           |
| **Total:** | | | **488.89 ETH** |

This brings the total amount of non-MOONEY assets to 488.89 ETH equivalent. If we calculate 5% of this number, we find that the total to be disseminated in this (example) quarter is 24.44 ETH.

Regarding the MOONEY amount, in Q3 2023 there was 12,860,625 MOONEY, so for the following quarter we multiply by 0.95 to find that the Q4 2023 distribution amount is 12,217,593.75 [vMOONEY](/docs/About/Glossary/vMOONEY). Multiplying that by 0.95 gives 11,606,714 distributed for Q1 2024, etc. The amount released each quarter reduces. Regardless, this amount is locked for four years and is not circulating, cannot be sold during that time, and can only be used for governance and voting.

## How are rewards for each project determined?

As outlined under our Projects system, citizens of the Space Acceleration Network and voting members evaluate each project and suggest a distribution of total rewards (as a percent) that they personally believe should go to each project.

Note: at this stage, contributors who are also citizens are prohibited from delegating any value towards projects that they are receiving potential rewards from.

We use a process of iterative normalization to determine the missing values (for projects they led). We implement a process using linear algebra to ensure that voting members distributions align with the parameters set by citizens, normalizing any deviations.

