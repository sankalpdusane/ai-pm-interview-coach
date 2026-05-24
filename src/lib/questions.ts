import type { Question, QuestionCategory } from "./types";

/**
 * The full question bank — 30 questions, 6 per category.
 * Difficulties are assigned based on the cognitive depth required:
 *   junior  → frameworks + basic reasoning
 *   mid     → trade-offs + prioritisation
 *   senior  → ambiguous, cross-functional, market-level thinking
 */
export const questions: Question[] = [
  // ─────────────────────────────────────────────
  // PRODUCT DESIGN  (q_001 – q_006)
  // ─────────────────────────────────────────────
  {
    id: "q_001",
    text: "How would you improve YouTube for creators in tier-2 Indian cities?",
    category: "product_design",
    difficulty: "mid",
    hint: "Use the CIRCLES framework: Comprehend → Identify users → Report needs → Cut through prioritisation → List solutions → Evaluate trade-offs → Summarise.",
  },
  {
    id: "q_002",
    text: "Design a feature for Swiggy to reduce food waste.",
    category: "product_design",
    difficulty: "mid",
    hint: "Start by clarifying the user (customer vs. restaurant partner) before designing — the solution differs completely depending on your target.",
  },
  {
    id: "q_003",
    text: "How would you redesign Google Maps for elderly users?",
    category: "product_design",
    difficulty: "junior",
    hint: "Anchor on specific accessibility pain points first; use Jobs-To-Be-Done to articulate what 'getting around safely' means for this cohort.",
  },
  {
    id: "q_004",
    text: "Design an onboarding experience for first-time mutual fund investors on Zerodha Coin.",
    category: "product_design",
    difficulty: "junior",
    hint: "Think about reducing anxiety and building trust — frame your solution around the emotional job-to-be-done, not just the functional one.",
  },
  {
    id: "q_005",
    text: "How would you design a carpooling feature inside Ola for daily office commuters?",
    category: "product_design",
    difficulty: "mid",
    hint: "Explicitly separate the two-sided marketplace: commuter needs vs. driver incentives — your solution must serve both sides to work.",
  },
  {
    id: "q_006",
    text: "You are the PM for WhatsApp Pay. Design a feature to increase transaction frequency among existing users.",
    category: "product_design",
    difficulty: "senior",
    hint: "Map the full habit loop (trigger → action → reward → investment) before jumping to features; frequency problems are usually habit problems.",
  },

  // ─────────────────────────────────────────────
  // METRICS  (q_007 – q_012)
  // ─────────────────────────────────────────────
  {
    id: "q_007",
    text: "Instagram Reels engagement dropped 18% last week. Walk me through your investigation.",
    category: "metrics",
    difficulty: "mid",
    hint: "Use the MECE diagnostic tree: internal changes (releases, infra) → external changes (seasonality, competition) → data pipeline issues — rule out each branch.",
  },
  {
    id: "q_008",
    text: "Define the North Star metric for a grocery delivery app.",
    category: "metrics",
    difficulty: "junior",
    hint: "A North Star metric must capture user value AND predict long-term revenue — 'orders placed' is a candidate, but ask yourself if it reflects whether users got what they wanted.",
  },
  {
    id: "q_009",
    text: "GPay transactions are up 20% but revenue is flat. Diagnose this.",
    category: "metrics",
    difficulty: "senior",
    hint: "Decompose revenue = volume × take rate × average transaction value; identify which lever broke the relationship between volume and revenue.",
  },
  {
    id: "q_010",
    text: "Daily active users on your B2B SaaS product grew 30% MoM, but NPS dropped from 42 to 28. What's happening and what do you do?",
    category: "metrics",
    difficulty: "senior",
    hint: "Consider new-user vs. power-user NPS separately — fast growth often dilutes NPS by adding unactivated or misfit users to the denominator.",
  },
  {
    id: "q_011",
    text: "Your app's Day-7 retention dropped from 40% to 31% after a redesign. How do you investigate and respond?",
    category: "metrics",
    difficulty: "mid",
    hint: "Segment retention by cohort (pre- vs. post-launch) and by user type before concluding causation — correlation with the launch date isn't enough.",
  },
  {
    id: "q_012",
    text: "Nykaa's checkout completion rate is 62%. What metrics would you look at to improve it, and what would you prioritise first?",
    category: "metrics",
    difficulty: "junior",
    hint: "Map the funnel step-by-step (cart → address → payment → confirm) and find the biggest drop-off point before proposing solutions.",
  },

  // ─────────────────────────────────────────────
  // STRATEGY  (q_013 – q_018)
  // ─────────────────────────────────────────────
  {
    id: "q_013",
    text: "Flipkart wants to enter the B2B SaaS market. How do you approach the first 90 days?",
    category: "strategy",
    difficulty: "senior",
    hint: "Structure your answer in three 30-day phases: learn (customer discovery) → align (ICP and wedge selection) → act (pilot with 3–5 design partners).",
  },
  {
    id: "q_014",
    text: "You have three features: reduce churn, increase activation, add AI search. How do you prioritise?",
    category: "strategy",
    difficulty: "mid",
    hint: "Apply RICE (Reach × Impact × Confidence ÷ Effort) explicitly — state your assumptions out loud so the interviewer can see your reasoning.",
  },
  {
    id: "q_015",
    text: "Should Notion build a mobile-native app or improve the web wrapper?",
    category: "strategy",
    difficulty: "mid",
    hint: "Frame this as a build vs. buy vs. improve decision — clarify Notion's strategic goal (retention vs. acquisition vs. monetisation) before recommending.",
  },
  {
    id: "q_016",
    text: "Amazon is entering the quick commerce space in India. How should Zepto respond?",
    category: "strategy",
    difficulty: "senior",
    hint: "Use a competitor-response framework: assess the threat's credibility → identify Zepto's durable moats → choose between differentiate, retreat, or partner.",
  },
  {
    id: "q_017",
    text: "LinkedIn wants to launch a job-matching product in Tier-3 Indian cities. Should they build, partner, or acquire?",
    category: "strategy",
    difficulty: "senior",
    hint: "Evaluate build/partner/acquire against three axes: time-to-market, control over user experience, and cost — then tie your recommendation to LinkedIn's strategic priorities.",
  },
  {
    id: "q_018",
    text: "Your product has strong retention among power users but zero word-of-mouth growth. What's your strategy to fix virality?",
    category: "strategy",
    difficulty: "mid",
    hint: "Identify the viral loop type (inherent, word-of-mouth, incentivised) that fits your product category before designing an intervention.",
  },

  // ─────────────────────────────────────────────
  // ESTIMATION  (q_019 – q_024)
  // ─────────────────────────────────────────────
  {
    id: "q_019",
    text: "How many UPI transactions happen in India per day?",
    category: "estimation",
    difficulty: "junior",
    hint: "Build bottom-up from smartphone users → UPI-enabled users → transaction frequency per segment (daily/weekly users); cross-check with a top-down anchor (NPCI reports ~500M/day).",
  },
  {
    id: "q_020",
    text: "Estimate Zomato's daily revenue in Mumbai.",
    category: "estimation",
    difficulty: "junior",
    hint: "Decompose: Mumbai households → ordering households → order frequency → AOV → Zomato take rate (~20–22%); be explicit about each assumption.",
  },
  {
    id: "q_021",
    text: "How many PMs work at Flipkart?",
    category: "estimation",
    difficulty: "junior",
    hint: "Estimate from the engineering org: ratio of engineers to PMs in a mature product company is roughly 8:1 to 10:1 — start with Flipkart's known engineering headcount.",
  },
  {
    id: "q_022",
    text: "Estimate the storage cost to run Instagram Reels for one year.",
    category: "estimation",
    difficulty: "senior",
    hint: "Break it into: daily uploads × average video size × replication factor × cloud storage cost per GB — don't forget CDN edge caching costs on top of origin storage.",
  },
  {
    id: "q_023",
    text: "How many electric vehicles will be sold in India in 2025?",
    category: "estimation",
    difficulty: "mid",
    hint: "Use adoption-curve thinking: total vehicle market × EV penetration rate (currently ~6–8%) adjusted for policy tailwinds and charging infrastructure constraints.",
  },
  {
    id: "q_024",
    text: "Estimate the market size for online mental health platforms in India.",
    category: "estimation",
    difficulty: "mid",
    hint: "Segment the addressable population by awareness + willingness to pay; use a top-down (% of urban working population with diagnosable conditions) and sanity-check bottom-up.",
  },

  // ─────────────────────────────────────────────
  // BEHAVIOURAL  (q_025 – q_030)
  // ─────────────────────────────────────────────
  {
    id: "q_025",
    text: "Tell me about a time you made a product decision with incomplete data.",
    category: "behavioural",
    difficulty: "mid",
    hint: "Use the STAR framework (Situation → Task → Action → Result) and explicitly name the uncertainty you faced and how you de-risked the decision.",
  },
  {
    id: "q_026",
    text: "Describe a failure in a project you led and what you learned.",
    category: "behavioural",
    difficulty: "mid",
    hint: "Strong answers own the failure clearly (avoid passive voice), show genuine reflection, and demonstrate a concrete change in behaviour afterward.",
  },
  {
    id: "q_027",
    text: "How do you handle it when engineering says no to your roadmap?",
    category: "behavioural",
    difficulty: "junior",
    hint: "Show that you seek to understand constraints first (tech debt, capacity, risk) before advocating — frame your answer around collaboration, not escalation.",
  },
  {
    id: "q_028",
    text: "Tell me about a time you had to influence a senior stakeholder without direct authority.",
    category: "behavioural",
    difficulty: "senior",
    hint: "Name the specific influence technique you used (data, pilot proposal, coalition building) and why you chose it over alternatives — this is where senior candidates differentiate.",
  },
  {
    id: "q_029",
    text: "Describe a moment when you had to kill a feature you personally believed in. How did you handle it?",
    category: "behavioural",
    difficulty: "senior",
    hint: "Interviewers want to see data-driven humility — show that you let evidence override personal conviction and communicated the decision clearly to stakeholders.",
  },
  {
    id: "q_030",
    text: "Give me an example of when you used customer research to change the direction of your product.",
    category: "behavioural",
    difficulty: "mid",
    hint: "Be specific about the research method (user interviews, surveys, session recordings) and show a clear causal link from insight → decision → measurable outcome.",
  },
];

// ─────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────

/**
 * Returns all questions belonging to the given category.
 *
 * @param category - One of the five `QuestionCategory` values.
 */
export function getQuestionsByCategory(category: QuestionCategory): Question[] {
  return questions.filter((q) => q.category === category);
}

/**
 * Returns a single random question, optionally filtered by category.
 * If the filtered list is empty (shouldn't happen with a well-formed bank)
 * it falls back to the full question list.
 *
 * @param category - Optional category filter.
 */
export function getRandomQuestion(category?: QuestionCategory): Question {
  const pool = category ? getQuestionsByCategory(category) : questions;
  const source = pool.length > 0 ? pool : questions;
  return source[Math.floor(Math.random() * source.length)];
}
