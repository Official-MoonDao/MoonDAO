import { MAX_BUDGET_USD, MOONDAO_ARBITRUM_TREASURY, MOONDAO_TREASURY } from 'const/config'

export function formatNumberUSStyle(n: string | number | bigint, compact: boolean = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    notation: compact ? 'compact' : 'standard',
  }).format(n as any)
}

/** Markdown project proposal template shown to authors and used as the canonical form. */
export function getProposalTemplate(maxBudgetUsd: number = MAX_BUDGET_USD): string {
  const maxFormatted = maxBudgetUsd.toLocaleString('en-US')

  return `\n*Note: Please remove the italicized instructions before submitting. Incomplete Key Results, missing Novelty & Prior Art, or asks above the quarterly max will be returned for rewrite.*\n

**Author:**
**Discord:**
**Date:**
**Other proposals from this Lead this quarter:** *None / list titles — one primary ask per Lead per quarter is strongly preferred.*

# Abstract

*This is a high-level description of the idea. Use ELI5 wording. Summarize what you will deliver in this quarter and how it advances lunar settlement.*

# Problem

*Describe the specific problem. Avoid vague “space is hard” framing. If this is hardware, state the operational failure (who, when, environment). If MoonDAO has funded related work before, acknowledge it and explain what is new.*

# Solution

*Describe the work that will be done this quarter. Keep scope to inspectable deliverables. Note open questions and future directions separately from funded objectives. Do not list entity formation, buying a general computer, or clearing tax bills as solutions.*

# Novelty & Prior Art

*Required. “This is innovative” without citations is not enough.*

**What already exists?**
*List the most relevant public prior art: papers, NASA/ESA/agency docs, open tools/datasets, commercial products, and prior MoonDAO projects. Link where possible.*

**What is new about this project?**
*State the specific deliverable or question that prior work does not already provide (new method, open pack for MoonDAO, integration, audience, test, etc.).*

**Why not just use the existing work?**
*Explain why pointing members at the citations above is insufficient for MoonDAO’s need this quarter.*

**Honesty check**
*If your contribution is mainly synthesis, translation, localization, education, or packaging of known ideas, say so. Do not claim “first ever,” “no open methodology exists,” or “completely unique” unless you can defend it against the literature.*

# Lunar Bridge

*Required. In 3–5 sentences, explain how this quarter’s outputs change MoonDAO’s path to a sustained human presence on the Moon. LEO tourism, generic STEAM branding, or “space is inspiring” alone are not enough.*

# Benefits

*Core benefits for MoonDAO members and the mission. If you claim revenue potential, separate long-term upside from what this grant actually buys. Do not promise megaproject outcomes from a single quarterly ask.*

# Risks

*Highlight risks (technical, schedule, partner dependency, safety). How are you mitigating them?*

# Objectives

*Prefer one focused objective. OKRs must use SMART principles. Key Results cannot be empty.*

**Objective #1:** *What will exist at the end of this project that does not exist today?*

**Key Results for Objective #1:**

- *Measurable result #1 (artifact, metric, or demo)*
- *Measurable result #2*
- *Measurable result #3*

**Member(s) responsible for OKR and their role:**

- *Name / role*

**Non-goals this quarter:**
- *Explicitly list what you will not build (e.g. full habitat design, flight hardware, company formation).*

# Team (Table A)

***Project Lead:** The Project Lead and representative for the project within the MoonDAO Senate. The Project Lead is responsible for:*

1. *Attending weekly town hall meetings, reviewing incoming proposals and voting on them within the Senate. Missed attendance will result in a 5% penalty to the rocketeer’s retroactive rewards.*
2. *Creating weekly updates to the community on the progress of the project in the “progress” channel on Discord.*
3. *Adding team members, removing team members, and making decisions about the use of the budget throughout the lifetime of the project.*
4. *Managing the multi-sig Treasury for the project as well as the payments for each of the members.*
5. *Creating the Final Report and returning unused funds to the MoonDAO Treasury.*

***Same-type prior work (required):** For each major deliverable, link prior work of that same type (e.g. prior course if promising a course; prior device build if promising hardware; prior report if promising a study). Domain expertise alone is not enough.*

***Initial Team:** Keep teams small and focused, with clear roles and deliverables. Prefer people who already work together over recruiting strangers after funding for technical Zoom brainstorms.*

| Project Lead | *@DiscordUsername* |
| :---- | :---- |
| **Initial Team** | *Role 1: “Developer” @DiscordUsername1: eth:0x0...1. “Description of the role and deliverable for this member” Role 2: “Designer” @DiscordUsername2: eth:0x0...2. “Description of the role and deliverable for this member”* |
| **Same-type prior work links** | *Deliverable → link to prior same-type work* |
| **Multi-sig signers\\*** | *Five required with their ETH addresses listed. “@DiscordUsername1: eth:0x0...1” … Multi-sig will be automatically created after proposal is submitted.* |

# Intellectual Property

*Required. Choose one and fill in details.*

- **Open (default):** Creative Commons / open-source license: *e.g. CC BY 4.0 / MIT*
- **Retained / patented:** *What the Lead or company keeps; what MoonDAO and the public still receive (report, demo, limited license, open subsets).*
- **Mixed:** *Describe the split.*

*Undisclosed proprietary lock-up is not acceptable. Retained IP is allowed when stated upfront with clear community-facing outputs.*

# Timeline (Table B)

| Days after Proposal Passes | Description |
| :---- | :---- |
| 0 | Proposal Passes |
| 7 | *Insert your milestones here.* |
| 30 |  |
| 60 |  |
| 90 | *Final deliverables, Town Hall presentation, return unused funds* |

**Deadline for the project:** *End of the funded quarter (confirm on the Project System page).*

# Budget (Table C)

*Total ask must be ≤ **$${maxFormatted}** (1/5 of this quarter’s project budget — confirm the live figure on moondao.com/propose). Classify every dollar.*

**What MoonDAO funds:** labor for inspectable deliverables, and specialized equipment/services the work uniquely needs (with ownership/access terms).

**What MoonDAO does not fund:** general computers/monitors/printers/furniture; LLC/sole-prop formation; tax bills, re-registration, or private company runway bailouts.

| Description | Class (A–E) | Amount (USD) | Justification |
| :---- | :---- | :---- | :---- |
| *e.g. Lead labor — report + simulations* | *A = labor* | *$* | *Hours × rate; tied to which KR* |
| *e.g. Specialized test fixture* | *B = specialized gear / DAO-retained tool* | *$* | *Why not ordinary personal kit; ownership/access terms* |
| *Foundational PC / home office* | *C — not allowed* | *$0* | *Remove* |
| *Entity formation / tax / bailout* | *D — not allowed* | *$0* | *Remove* |
| *Other overhead* | *E* | *$* | *Scrutinize* |
| **Total** |  | *≤ $${maxFormatted}* |  |

*If success depends on a university, launch provider, or other partner: attach LOI, quote, or access MOU before the vote.*

# Transactions (Table D)

*Please write out the specific transactions that need to be executed if this proposal passes. Include the exact amount, token type, and receiving address (the multi-sig if there is more than one transaction over the project lifetime).*

| Transaction Type | Amount | Token Type | Receiving Address |
| :---- | :---- | :---- | :---- |
| *Send* | *0* | *ETH* | *TBD* |

# Pre-submit checklist

- [ ] Ask ≤ posted quarterly max ($${maxFormatted})
- [ ] Novelty & Prior Art filled with links
- [ ] Lunar Bridge paragraph completed
- [ ] Key Results are non-empty and testable
- [ ] Budget classes filled; (C) and (D) are $0
- [ ] Specialized gear has ownership/access terms
- [ ] Same-type prior work linked per major deliverable
- [ ] IP disclosure completed
- [ ] Only one primary proposal from this Lead this quarter
- [ ] Partner LOIs/quotes attached if the plan depends on them
- [ ] No megaproject OKRs mixed into this quarter’s funded scope
`
}

/** @deprecated Prefer getProposalTemplate(MAX_BUDGET_USD) so the max stays current. */
export const TEMPLATE = getProposalTemplate()

export const FINAL_REPORT_TEMPLATE = `
*The title of the project will be included at the top of the file."

*\\*Please read [Projects System v6: Completion](https://docs.moondao.com/Projects/Project-System#completion) before submitting to understand the process of submitting a project final report. When ready, download this doc as a markdown file (File \\> Download \\> Markdown (.md)) and then upload and submit it at [https://moondao.com/report](https://moondao.com/report)*

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

   **Grade (Do not fill out \\- Exec Leads will review):** *Overall Grade For The Objective*  
      *Superb \\= This is reserved for if the project went incredibly well without any flaws and vastly surpassed all original metrics. Very few projects will meet this grade.*

   *Exceeds Expectations \\= Did better than expected. The team surpassed expectations and went above and beyond the original scope of the project.*

   *Meets Expectations \\= The project met all its original goals and sufficiently hit all the criteria.*

   *Does Not Meet Expectations \\= The project did not achieve its original goal.*

## Member Contributions

*To be filled out by each Project Contributor.*

**@TeamMemberName1:** *A paragraph or two about the work that the member did on the team and a link to the work they did or contributions.*

**@TeamMemberName2:** *A paragraph or two about the work that the member did on the team and a link to the work they did or contributions.*

## Reward Distribution (Table A)

*To be filled out by the Project Lead*

[*Link to the Coordinape*](https://coordinape.com/)*: Make the Astronauts the admin of the coordinape circle.*

| Member Name | % of total rewards | Upfront Payment Received | Wallet to receive ETH |
| :---- | :---- | :---- | :---- |
| *@TeamMemberName* | *21%* | *3,000 DAI, 50,000 MOONEY* |  |

## Treasury Transparency (Table B)

*To be filled out by the Project Lead*

*Link to Treasury with **unused funds returned to the [MoonDAO Treasury](https://app.safe.global/home?safe=eth:0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9).***

*Arbitrum Address: arb1:${MOONDAO_ARBITRUM_TREASURY}*  
*Ethereum Address: eth:${MOONDAO_TREASURY}*

| Txn Title | Reason | Amount | Recipient | Etherscan Link or Gnosis Link | Deliverable |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Legal Retainer | Retainer for contract lawyer | 3,000 DAI | Lawyers Inc. | **\\<link\\>** | **\\<link\\>** or if nothing to show please include a description of what was delivered. |
`
