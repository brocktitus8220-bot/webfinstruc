export interface Resource {
  slug: string;
  title: string;
  summary: string;
  category: "Guide" | "Taxes" | "Planning";
  readMinutes: number;
  body: string[];
}

/** Placeholder articles. Real content will come from a CMS later. */
export const RESOURCES: Resource[] = [
  {
    slug: "baseline-income",
    title: "Plan around your baseline month, not your average",
    summary: "Why the lowest reliable month is a safer number for fixed costs.",
    category: "Planning",
    readMinutes: 4,
    body: [
      "Averages hide the months that hurt. If your income swings, a budget built on the average will come up short in exactly the months you can least afford it.",
      "Your baseline is the lowest month you can reasonably count on. We ignore true outliers, such as a month with almost no income because you took time off, so one strange month does not drag the baseline to zero.",
      "Cover fixed costs from the baseline. Use anything above it for savings, taxes, and goals.",
    ],
  },
  {
    slug: "quarterly-taxes",
    title: "Quarterly estimated taxes, explained simply",
    summary: "What they are, when they are due, and how safe harbor keeps penalties away.",
    category: "Taxes",
    readMinutes: 6,
    body: [
      "If no employer withholds tax from your pay, you are expected to pay during the year in four installments.",
      "Safe harbor rules let you avoid underpayment penalties by paying a set share of last year's tax, even if this year turns out bigger.",
      "Setting aside a fixed percentage of every payment as it arrives is the easiest way to be ready for each due date.",
    ],
  },
  {
    slug: "runway",
    title: "How many months of runway do you need?",
    summary: "A practical target for people whose income is not on a schedule.",
    category: "Guide",
    readMinutes: 3,
    body: [
      "Runway is your cash divided by what you spend in a typical month.",
      "With irregular income, aim higher than a salaried worker would. Six months is a common starting point; more if your work is seasonal.",
    ],
  },
];
