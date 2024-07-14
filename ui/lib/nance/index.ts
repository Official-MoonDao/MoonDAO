export function formatNumberUSStyle(
  n: string | number | bigint,
  compact: boolean = false
) {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    notation: compact ? 'compact' : 'standard',
  }).format(n as any)
}

export const TEMPLATE = `## Abstract\n*This is a high-level description of the idea. Please use ELI5 (explain like I’m five years old) wording and summarize things for anyone to understand what you want to achieve.*\n\n## Problem\n*Describe the problem your proposal solves.*\n\n## Solution\n*Describe the “meat & potatoes” of the proposal. Go into necessary detail about the work that needs to be done, alternative solutions considered, open questions, and future directions. Keep it concise.*\n\n## Benefits\n*Point out the core benefits of the proposal implementation and how it will affect MoonDAO. If the proposal can create revenue please create justification for how much revenue it could generate.*\n\n## Risks\n*Highlight any risks from implementing the proposal, how could this go wrong? How are you addressing those risks?*\n\n## Objectives\n*You can write as many OKRs as you think are needed. One focused goal is preferred instead of many. OKRs should use SMART principles (Specific, Measurable, Achievable, Relevant, and Time-Bound).*\n\n**Objective #1:** *What do you want to achieve with this project. Be specific.*\n**Key Results for Objective #1:**\n* *What is a measurable result that indicates this objective has been met?*\n* *Include 3-4 relevant metrics that indicate success for the objective*\n\n**Member(s) responsible for OKR and their role:**\n* *Is there a specific member or set of members that are responsible for this particular objective? If all of them are responsible for this just say “All”*`;
