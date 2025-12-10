// Config

export interface SpellingCorrection {
  pattern: RegExp;
  replacement: string;
}

export const SPELLING_CORRECTIONS: SpellingCorrection[] = [
  // MoonDAO variations
  { pattern: /\bMoondow\b/gi, replacement: "MoonDAO" },
  { pattern: /\bHoondow\b/gi, replacement: "MoonDAO" },
  { pattern: /\bMoondao\b/gi, replacement: "MoonDAO" },
  { pattern: /\bMoonDao\b/gi, replacement: "MoonDAO" },
  { pattern: /\bMoon Dow\b/gi, replacement: "MoonDAO" },
  { pattern: /\bMoon D A O\b/gi, replacement: "MoonDAO" },
  { pattern: /\bMoon D\.A\.O\.\b/gi, replacement: "MoonDAO" },
  // Name corrections
  { pattern: /\bIman\b/gi, replacement: "Eiman" },
];

export const DEFAULT_MODELS = {
  whisper: "whisper-large-v3",
  llm: "llama-3.3-70b-versatile",
} as const;

export const AUDIO_CONFIG = {
  maxSizeMB: 24,
  maxAllowedSizeMB: 25,
  targetSizeMB: 20,
  lowerTargetSizeMB: 18,
  minBitrate: 32,
  maxBitrate: 96,
  sampleRate: 16000,
  channels: 1,
  fallbackDurationSeconds: 3600,
} as const;

export const LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 2000,
  retry: {
    maxRetries: 3,
    baseWaitTimeSeconds: 2,
    transcriptionWaitTimeSeconds: 5,
  },
  chunkDelayMs: 2000,
} as const;

export const TOKEN_CONFIG = {
  charsPerToken: 4,
  reservedTokensBuffer: 2000,
  contextWindowWarningThreshold: 80,
} as const;

export const CONTEXT_WINDOWS = {
  "128k": 128000,
  "256k": 256000,
} as const;

export const CONTEXT_WINDOW_MODELS = {
  "128k": ["llama-3.3-70b", "llama-3.1-8b", "qwen", "kimi"],
  "256k": ["kimi-k2"],
} as const;

export const SYSTEM_MESSAGES = {
  summarizer:
    "You are a helpful assistant that summarizes Town Hall meetings for the MoonDAO community. Provide clear, structured summaries with actionable information.",
} as const;

export const PROMPT_TEMPLATES = {
  summary: `You are summarizing a MoonDAO Town Hall meeting transcript. MoonDAO Townhalls follow a structured format. Please organize your summary accordingly:

## Guest Speaker
- Name and background of the guest
- Key topics discussed by the guest
- Important points from their presentation or conversation with the MoonDAO team
- Note: Sometimes there is no guest speaker

## Project Updates
- List each active project and its current status
- Updates from project leaders
- Progress, milestones, or challenges mentioned
- Note: Sometimes there are no project updates or no active projects

## New Proposals
- Any proposals being presented for upcoming votes
- Key details, rationale, and implications of each proposal
- Voting timelines if mentioned
- Budget if mentioned in ETH or ERC20(DIA, USDC, USDT, etc.), do not mention USD values
- Note: Sometimes there are no new proposals

## Additional Information
- Any other important announcements, updates, or community news
- Action items or next steps for the community
- Important dates or deadlines
- Note: This section may not always be present

IMPORTANT FORMATTING RULES:
- Use ## for section headers (not **bold**)
- Use - for bullet points
- Add TWO blank lines between sections
- If a section is not present in the transcript, omit it entirely (don't write "No guest speaker" or "No updates")
- Make it easy to scan and understand

Transcript:
{transcript}

Please provide the summary now:`,

  consolidation: `You are consolidating multiple summaries from a MoonDAO Town Hall meeting. These summaries were created by splitting a long transcript into chunks. Please merge them into a single, well-organized summary following the same format. Remove any duplicate information and ensure the summary flows naturally:

## Guest Speaker
- Name and background of the guest
- Key topics discussed by the guest
- Important points from their presentation or conversation with the MoonDAO team

## Project Updates
- List each active project and its current status
- Updates from project leaders
- Progress, milestones, or challenges mentioned

## New Proposals
- Any proposals being presented for upcoming votes
- Key details, rationale, and implications of each proposal
- Voting timelines if mentioned
- Budget if mentioned in ETH or ERC20(DIA, USDC, USDT, etc.), do not mention USD values

## Additional Information
- Any other important announcements, updates, or community news
- Action items or next steps for the community
- Important dates or deadlines

IMPORTANT FORMATTING RULES:
- Use ## for section headers (not **bold**)
- Use - for bullet points
- Add TWO blank lines between sections
- If a section is not present, omit it entirely

Summaries to consolidate:
{summaries}

Please provide the consolidated summary now:`,
} as const;
