/** 52 writing prompts — one per week, cycling by day-of-year. Fully offline. */
const PROMPTS: readonly string[] = [
  "What is one thing that went better than expected today?",
  "Describe a problem you are currently working through.",
  "What did you learn this week that genuinely surprised you?",
  "Who made a positive impact on you recently, and how?",
  "What is a decision you have been putting off, and why?",
  "Write about a moment from the past week you want to remember.",
  "What is draining your energy right now, and what would change that?",
  "Describe your ideal version of tomorrow.",
  "What is something you keep meaning to explore but haven't started?",
  "What assumption are you carrying that might be wrong?",
  "Write about a skill you are building and where you stand.",
  "What is the most interesting thing you read or heard this week?",
  "Describe a conversation that made you think differently.",
  "What would you do if you knew you couldn't fail?",
  "What is one habit you want to build, and what is the smallest first step?",
  "Write about a time you changed your mind about something important.",
  "What are three things you are genuinely grateful for today?",
  "What is a project or idea you have been excited about lately?",
  "Describe the state of a relationship that matters to you.",
  "What is something you did recently that felt meaningful?",
  "What is a belief you hold that most people around you don't share?",
  "Write about a challenge you are facing and what you have tried so far.",
  "What does a good day look like for you right now?",
  "What is one thing you would tell your past self from a year ago?",
  "Describe something you are looking forward to in the next month.",
  "What is taking up mental space that you wish you could let go of?",
  "Write about a tool, method, or idea that has improved your work.",
  "What is the most important thing you need to finish this week?",
  "Describe a moment of unexpected beauty or clarity you experienced recently.",
  "What question are you sitting with that you don't have an answer to yet?",
  "Write about something you are proud of that no one knows about.",
  "What is a pattern in your life you have noticed lately?",
  "Describe a risk worth taking that you have been holding back on.",
  "What is something you are learning about yourself through your work?",
  "Write about a person who has shaped how you think.",
  "What would make this week feel successful, in your own terms?",
  "Describe a small win you had recently that deserves acknowledgment.",
  "What is an idea you keep returning to but haven't written down yet?",
  "Write about something that used to matter to you but no longer does.",
  "What is a constraint in your life that might actually be a gift?",
  "Describe the last time you were fully absorbed in something.",
  "What is a goal you have that feels too big — and what is one piece of it?",
  "Write about a piece of feedback that stung, and what it taught you.",
  "What are you optimizing for right now in your life?",
  "Describe something you do to recover when things feel overwhelming.",
  "What is the gap between who you are now and who you want to become?",
  "Write about a place where you feel most like yourself.",
  "What is a question someone asked you recently that you're still thinking about?",
  "Describe a trade-off you are living with and whether it still makes sense.",
  "What is something you understand now that you wish you had known sooner?",
  "Write about a creative problem you are trying to solve.",
  "What does rest look like for you, and are you getting enough of it?",
];

/**
 * Returns today's prompt, deterministically chosen by day-of-year.
 * The same day always shows the same prompt on all devices.
 */
export function getDailyPrompt(now: Date = new Date()): string {
  const start     = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return PROMPTS[dayOfYear % PROMPTS.length]!;
}
