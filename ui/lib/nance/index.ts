import { MOONDAO_ARBITRUM_TREASURY, MOONDAO_TREASURY } from 'const/config'
import { v4 } from 'uuid'

export function uuidGen(): string {
  return v4().replaceAll('-', '')
}

export function formatNumberUSStyle(
  n: string | number | bigint,
  compact: boolean = false
) {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    notation: compact ? 'compact' : 'standard',
  }).format(n as any)
}

export const TEMPLATE = `\n*Note: Please remove the italicized instructions before submitting*\n

**Author:**
**Date:**

# Abstract

*This is a high-level description of the idea. Please use ELI5 (explain like I’m five years old) wording and summarize things for anyone to understand what you want to achieve.*

# Problem

*Describe the problem your proposal solves.*

# Solution

*Describe the “meat & potatoes” of the proposal. Go into necessary detail about the work that needs to be done, alternative solutions considered, open questions, and future directions. Keep it concise.*

# Benefits

*Point out the core benefits of the proposal implementation and how it will affect MoonDAO. If the proposal can create revenue please create justification for how much revenue it could generate.*

# Risks

*Highlight any risks from implementing the proposal, how could this go wrong? How are you addressing those risks?*

# Objectives

*You can write as many OKRs as you think are needed. One focused goal is preferred instead of many. OKRs should use SMART principles (Specific, Measurable, Achievable, Relevant, and Time-Bound).*

**Objective \#1:** *What do you want to achieve with this project. Be specific.*  
**Key Results for Objective \#1**: 

- *What is a measurable result that indicates this objective has been met?*  
- *Include 3-4 relevant metrics that indicate success for the objective*

**Member(s) responsible for OKR** **and their role:**

- *Is there a specific member or set of members that are responsible for this particular objective? If all of them are responsible for this just say “All”*

# Team (Table A)

***Project Lead:** The Project Lead and representative for the project within the MoonDAO Senate. The Project Lead is responsible for:*

1. *Attending weekly town hall meetings, reviewing incoming proposals and voting on them within the Senate. Missed attendance will result in a 5% penalty to the rocketeer’s retroactive rewards.*  
2. *Creating weekly updates to the community on the progress of the project in the “progress” channel on DIscord.*  
3. *Adding team members, removing team members, and making decisions about the use of the budget throughout the lifetime of the project.*  
4. *Creating and managing the multi-sig Treasury for the project as well as the payments for each of the members.*  
5. *Creating the Final Report and returning unused funds to the MoonDAO Treasury.*

***Initial Team:** Projects may not need an initial team. It can just be an individual submitting a proposal. You may also create generic roles and hire other teammates after the project is approved. As a general rule of thumb, try to keep teams small and focused in the beginning, **with clear roles, deliverables, and OKRs for each member**. Team members are responsible for:*

1. *Posting a weekly update in the “progress” channel on Discord with their contributions that week. Not posting a weekly update will result in a 5% penalty to their retroactive rewards.*

| Project Lead | *@DiscordUsername* |
| :---- | :---- |
| **Initial Team** | *Role 1: “Developer” @DiscordUsername1: eth:0x0...1. “Description of the role and deliverable for this member” Role 2: “Designer” @DiscordUsername2: eth:0x0...2. “Description of the role and deliverable for this member”* |
| **Multi-sig signers\*** | *Five required with their ETH addresses listed. “@DiscordUsername1: eth:0x0...1” “@DiscordUsername2: eth:0x0...2” “@DiscordUsername3: eth:0x0...3” “@DiscordUsername4: eth:0x0...4” “@DiscordUsername5: eth:0x0...5” You can create a multi-sig [here](https://app.safe.global/welcome)* |
| **Multi-sig Address\*** | *ETH address with the multi-sig* |

# Timeline (Table B)

| Days after Proposal Passes | Description |
| :---- | :---- |
| 0 | Proposal Passes |
| 7 | *Insert your milestones here.* |
|  |  |

**Deadline for the project: End of Q3.**

# Transactions (Table C)

*Please write out the specific transactions that need to be executed if this proposal passes. Please include the exact amount and token type and the receiving address (this is the multi-sig if there is more than one transaction that needs to be executed throughout the lifetime of this project.)*

| Transaction Type | Amount | Token Type | Receiving Address |
| :---- | :---- | :---- | :---- |
| *Send* | *0* | *ETH* | *TBD* |
`

export const FINAL_REPORT_TEMPLATE = `
*The title of the project will be included at the top of the file."

*\*Please read [Projects System v6: Completion](https://docs.moondao.com/Projects/Project-System#completion) before submitting to understand the process of submitting a project final report. When ready, download this doc as a markdown file (File \> Download \> Markdown (.md)) and then upload and submit it at [https://moondao.com/report](https://moondao.com/report)*

## Original Proposal

*To be filled out by the Project Lead.*

**Link to Original Proposal:** *Link to the original proposal*  
**Original Abstract:** *Please include the original abstract from the project proposal.*

## Results

*To be filled out by the Project Lead.*

*For each OKR please copy the exact objective and result as appeared on your original proposal. Make a new outline for each objective and key result and keep it in this format.*

1. **Objective:** *Original objective as it appears in your initial proposal.*

   **Summary:** *Overall discussion of the objective and how it went.*  
   **Learnings**: *What went well? What went wrong? How could it be improved?*  
   **Maintenance**: *Create documentation if there is long-term operation of the work that you created so that our operations team can continue supporting the work.*  
   **Results:** *Please provide the actual results for each key objective.*  
   1. **Key Result**: *Original key result as it appears in your initial proposal.*  
      **Results**: *The actual quantitative result or a link to the work completed.*  
   2. **Key Result**: *Original key result as it appears in your initial proposal.*  
      **Results**: *The actual quantitative result or a link to the work completed.*

   **Grade (Do not fill out \- Exec Leads will review):** *Overall Grade For The Objective*  
      *Superb \= This is reserved for if the project went incredibly well without any flaws and vastly surpassed all original metrics. Very few projects will meet this grade.*

   *Exceeds Expectations \= Did better than expected. The team surpassed expectations and went above and beyond the original scope of the project.*

   *Meets Expectations \= The project met all its original goals and sufficiently hit all the criteria.*

   *Does Not Meet Expectations \= The project did not achieve its original goal.*

## Member Contributions

*To be filled out by each Project Contributor.*

**@TeamMemberName1:** *A paragraph or two about the work that the member did on the team and a link to the work they did or contributions.*

**@TeamMemberName2:** *A paragraph or two about the work that the member did on the team and a link to the work they did or contributions.*

## Reward Distribution (Table A)

*To be filled out by the Project Lead*

[*Link to the Coordinape*](https://coordinape.com/)*: Make the Astronauts the admin of the coordinape circle.*

| Member Name | % of total rewards | Upfront Payment Received | Wallet to receive ETH |
| :---- | :---- | :---- | :---- |
| *@TeamMemberName* | *21%* | *3,000 DAI, 50,000 MOONEY* |  |

## Treasury Transparency (Table B)

*To be filled out by the Project Lead*

*Link to Treasury with **unused funds returned to the [MoonDAO Treasury](https://app.safe.global/home?safe=eth:0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9).***

*Arbitrum Address: arb1:${MOONDAO_ARBITRUM_TREASURY}*  
*Ethereum Address: eth:${MOONDAO_TREASURY}*

| Txn Title | Reason | Amount | Recipient | Etherscan Link or Gnosis Link | Deliverable |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Legal Retainer | Retainer for contract lawyer | 3,000 DAI | Lawyers Inc. | **\<link\>** | **\<link\>** or if nothing to show please include a description of what was delivered. |
`
