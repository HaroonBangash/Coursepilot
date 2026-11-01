import { DemoExample, DemoPlayer } from '@/components/demo/DemoPlayer';
import { SiteNav } from '@/components/shared/SiteNav';

const examples: DemoExample[] = [
  {
    title: 'Fully supported answer',
    mode: 'Answer',
    state: 'SUPPORTED',
    question: 'Define reinforcement learning using agent, environment, and reward.',
    answer:
      'Reinforcement learning is a setup where an agent interacts with an environment, takes actions, and receives rewards. The agent updates its policy over time to maximise cumulative reward.',
    sources: [
      { module: 'AI Foundations in Practice', file: 'Reinforcementlearning.pptx', location: 'Slide 7' },
      { module: 'AI Foundations in Practice', file: 'Reinforcementlearning.pptx', location: 'Slide 9' },
    ],
  },
  {
    title: 'Partly supported answer',
    mode: 'Answer',
    state: 'PARTIAL',
    question: 'How should uncertainty be communicated in time-series forecasting visuals?',
    answer:
      'The notes support using clear visual cues and annotations to avoid misleading interpretation. They provide partial guidance for forecasting communication, but not a complete dedicated framework for uncertainty intervals in all contexts.',
    sources: [
      { module: 'Data Visualisation And Exploratory Analytics', file: 'Annotations_and_Communication.pptx', location: 'Slide 14' },
    ],
  },
  {
    title: 'Insufficient evidence',
    mode: 'Answer',
    state: 'INSUFFICIENT',
    question: 'Provide official legal penalties for GDPR non-compliance from these course slides.',
    answer: 'Not enough evidence in the provided course materials to answer this reliably.',
    sources: [],
  },
  {
    title: 'Grounded summary mode',
    mode: 'Summary',
    state: 'SUPPORTED',
    question: 'Summarize MapReduce from week 1 notes.',
    answer:
      'MapReduce is presented as a distributed processing model with map, shuffle, and reduce stages. Map transforms input into key-value pairs, shuffle groups values by key, and reduce aggregates grouped values into final output.',
    sources: [
      { module: 'Big Data And Machine Learning Applications', file: 'Week1_MapReduce.pdf', location: 'Page 12' },
      { module: 'Big Data And Machine Learning Applications', file: 'Week1_MapReduce.pdf', location: 'Page 15' },
    ],
  },
];

export default function DemoPage() {
  return (
    <main className="academic-shell min-h-screen">
      <div className="site-container py-10 md:py-14">
        <SiteNav />

        <section className="mx-auto max-w-3xl py-10 text-center lg:py-14">
          <span className="inline-block rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-slate-950">Demo</span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">See CoursePilot in action</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 md:text-base">
            Realistic revision examples showing complete answers, partial answers, safe refusals, and summary mode — all grounded in course materials.
          </p>
        </section>

        <DemoPlayer examples={examples} />

        <p className="mt-5 text-center text-xs text-slate-300">Simulated walkthrough using example course notes.</p>
      </div>
    </main>
  );
}
