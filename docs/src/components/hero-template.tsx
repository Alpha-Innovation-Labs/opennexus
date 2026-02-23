'use client';

import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const HOME_TEMPLATE = {
  headline: '',
  description: '',
  installCommand: '',
  primaryCtaLabel: '',
  primaryCtaHref: '/docs',
} as const;

type ExampleTab = {
  id: string;
  label: string;
  kind: 'bullets' | 'table';
  bullets?: [
    { keyword: string; sentence: string },
    { keyword: string; sentence: string },
    { keyword: string; sentence: string },
  ];
  heading?: string;
  columns?: [string, string];
  rows?: Array<{
    label: string;
    value: string;
    href?: string;
  }>;
};

const FALLBACK_EXAMPLES = [
  {
    id: 'example-a',
    label: 'Context Driven Development',
    kind: 'bullets',
    bullets: [
      {
        keyword: 'Specification',
        sentence: 'Context files define outcomes with E2E-testable actions.',
      },
      {
        keyword: 'Reproducibility',
        sentence: 'Projects can be rebuilt from context files only.',
      },
      {
        keyword: 'Knowledge',
        sentence: 'Context preserves feature intent even when code is rewritten.',
      },
    ],
  },
  {
    id: 'example-b',
    label: 'Commands',
    kind: 'table',
    columns: ['Command', 'Purpose'],
    rows: [
      {
        label: 'nexus-0-prompt',
        value: 'Rewrite prompts for clarity',
        href: '/docs/commands/nexus-0-prompt',
      },
      {
        label: 'nexus-1.1-context-search',
        value: 'Find relevant contexts',
        href: '/docs/commands/nexus-1-1-context-search',
      },
      {
        label: 'nexus-1.2-context-create',
        value: 'Create context specs',
        href: '/docs/commands/nexus-1-2-context-create',
      },
      {
        label: 'nexus-1.3-context-sync',
        value: 'Generate context sync report',
        href: '/docs/commands/nexus-1-3-context-sync',
      },
      {
        label: 'nexus-1.4-context-review',
        value: 'Audit context quality',
        href: '/docs/commands/nexus-1-4-context-review',
      },
      {
        label: 'nexus-1.5-context-from-code',
        value: 'Propose contexts from code',
        href: '/docs/commands/nexus-1-5-context-from-code',
      },
      {
        label: 'nexus-2-investigate',
        value: 'Multi-agent investigation',
        href: '/docs/commands/nexus-2-investigate',
      },
      {
        label: 'nexus-3.5-critique',
        value: 'Critique plan risks',
        href: '/docs/commands/nexus-3-5-critique',
      },
      {
        label: 'nexus-4-code',
        value: 'Orchestrate parallel coding',
        href: '/docs/commands/nexus-4-code',
      },
      {
        label: 'nexus-create-skill-from-codebase',
        value: 'Generate llms.txt',
        href: '/docs/commands/nexus-create-skill-from-codebase',
      },
    ],
  },
  {
    id: 'example-c',
    label: 'Skills',
    kind: 'table',
    heading: 'RUST',
    columns: ['Skill', 'Purpose'],
    rows: [
      {
        label: 'ratkit',
        value: 'Rust TUI component library skill',
        href: '/docs/skills/rust/ratkit',
      },
      {
        label: 'opencode-rs-sdk',
        value: 'OpenCode Rust SDK skill',
        href: '/docs/skills/rust/opencode-rs-sdk',
      },
    ],
  },
] satisfies ExampleTab[];

export function HeroTemplate() {
  const examples = FALLBACK_EXAMPLES;

  const [activeTab, setActiveTab] = useState(examples[0]?.id ?? 'example-a');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [activeInstall, setActiveInstall] = useState('cargo');

  const selectedExample = examples.find((item) => item.id === activeTab) ?? examples[0];
  const installOptions = [
    { label: 'cargo', command: HOME_TEMPLATE.installCommand || 'cargo install opennexus' },
    { label: 'npm', command: 'npm install -g opennexus' },
    { label: 'uv', command: 'uv tool install opennexus' },
    {
      label: 'homebrew',
      command: 'brew tap Alpha-Innovation-Labs/tap && brew install opennexus',
    },
    {
      label: 'scoop',
      command:
        'scoop bucket add alpha-innovation-labs https://github.com/Alpha-Innovation-Labs/scoop-bucket && scoop install opennexus',
    },
    { label: 'aur', command: 'In progress (not published yet)' },
  ] as const;
  const selectedInstall = installOptions.find((item) => item.label === activeInstall) ?? installOptions[0];

  async function handleCopyCommand(command: string) {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  }

  return (
    <main className="relative isolate flex flex-1 items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(14,116,144,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(14,116,144,0.08)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] dark:bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.08)_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_56%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.28),transparent_56%)]" />

      <section className="relative mx-auto flex w-full max-w-(--fd-layout-width) flex-col gap-6 px-6 py-14 md:px-8 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:content-center lg:items-center lg:gap-x-8 lg:gap-y-3 lg:px-10 lg:py-20">
        <div className="space-y-7 lg:mx-auto lg:max-w-2xl">
          <p className="inline-flex w-fit rounded-full border border-zinc-300 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-cyan-300">
            Nexus - Context Driven Development
          </p>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
              {HOME_TEMPLATE.headline || 'Context Driven Development'}
            </h1>
            <p className="max-w-2xl text-base text-zinc-700 dark:text-zinc-300 sm:text-lg">
              {HOME_TEMPLATE.description ||
                'OpenNexus installs context-driven workflows in your repo with slash commands, rules, templates, and llms.txt-to-skill generation.'}
            </p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-2xl shadow-slate-300/50 lg:mx-auto lg:max-w-xl dark:border-white/10 dark:bg-zinc-950/85 dark:shadow-cyan-950/50">
          <div className="mb-4 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  item.id === activeTab
                    ? 'bg-cyan-300 text-zinc-950'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900">
            {selectedExample?.kind === 'bullets' ? (
              <ul className="space-y-0 text-sm leading-7 text-zinc-900 dark:text-zinc-100">
                {selectedExample.bullets?.map((bullet) => (
                  <li key={`${selectedExample.id}-${bullet.keyword}`} className="flex gap-2">
                    <span className="text-cyan-600 dark:text-cyan-300">-</span>
                    <span>
                      <strong>{bullet.keyword}</strong>: {bullet.sentence}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                {selectedExample?.heading ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">{selectedExample.heading}</p>
                ) : null}
                <table className="w-full border-collapse text-left text-sm text-zinc-900 dark:text-zinc-100">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-600 dark:border-white/10 dark:text-zinc-300">
                      <th className="px-2 py-2 font-semibold">{selectedExample?.columns?.[0]}</th>
                      <th className="px-2 py-2 font-semibold">{selectedExample?.columns?.[1]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedExample?.rows?.map((row) => (
                      <tr key={`${selectedExample.id}-${row.label}`} className="border-b border-zinc-100 align-top dark:border-white/5">
                        <td className="px-2 py-2 font-mono text-cyan-700 dark:text-cyan-300">
                          {row.href ? (
                            <Link
                              href={row.href}
                              className="underline decoration-zinc-300 underline-offset-4 hover:decoration-cyan-500 dark:decoration-white/20 dark:hover:decoration-cyan-300"
                            >
                              {row.label}
                            </Link>
                          ) : (
                            row.label
                          )}
                        </td>
                        <td className="px-2 py-2 text-zinc-800 dark:text-zinc-100">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white/85 p-3 shadow-lg shadow-slate-300/50 lg:col-span-2 dark:border-white/10 dark:bg-zinc-950/70 dark:shadow-cyan-950/40">
          <div className="space-y-2">
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Quickstart</p>
              <div className="flex flex-wrap gap-2">
                {installOptions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveInstall(item.label)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      item.label === activeInstall
                        ? 'bg-cyan-300 text-zinc-950'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-zinc-900 px-3 py-2 font-mono text-sm text-cyan-300">{selectedInstall.command}</code>
              {selectedInstall.label !== 'aur' ? (
                <button
                  type="button"
                  onClick={() => handleCopyCommand(selectedInstall.command)}
                  aria-label={`Copy ${selectedInstall.label} install command`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-white/15 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  {copiedCommand === selectedInstall.command ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
