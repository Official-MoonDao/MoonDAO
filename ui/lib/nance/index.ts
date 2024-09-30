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
## Abstract
*This is a high-level description of the idea. Please use ELI5 (explain like I'm five years old) wording and summarize things for anyone to understand what you want to achieve.*

## Problem
*Describe the problem your proposal solves.*

## Solution
*Describe the "meat & potatoes" of the proposal. Go into necessary detail about the work that needs to be done, alternative solutions considered, open questions, and future directions. Keep it concise.*

## Benefits
*Point out the core benefits of the proposal implementation and how it will affect MoonDAO. If the proposal can create revenue please create justification for how much revenue it could generate.*

## Risks
*Highlight any risks from implementing the proposal, how could this go wrong? How are you addressing those risks?*

## Objectives
*You can write as many OKRs as you think are needed. One focused goal is preferred instead of many. OKRs should use SMART principles (Specific, Measurable, Achievable, Relevant, and Time-Bound).*

**Objective #1:** *What do you want to achieve with this project. Be specific.*

**Key Results for Objective #1:**
* *What is a measurable result that indicates this objective has been met?*
* *Include 3-4 relevant metrics that indicate success for the objective*

**Member(s) responsible for OKR and their role:**
* *Is there a specific member or set of members that are responsible for this particular objective? If all of them are responsible for this just say "All"*

## Deadline
*Enter the expected completion date for this project..*`;
