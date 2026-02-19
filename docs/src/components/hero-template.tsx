'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const HOME_TEMPLATE = {
  headline: '',
  description: '',
  installCommand: '',
  primaryCtaLabel: '',
  primaryCtaHref: '/docs',
  secondaryCtaLabel: '',
  secondaryCtaHref: 'https://github.com/Alpha-Innovation-Labs/opennexus',
  examples: [
    { id: 'example-a', label: '', code: '' },
    { id: 'example-b', label: '', code: '' },
    { id: 'example-c', label: '', code: '' },
  ],
} as const;

const FALLBACK_EXAMPLES = [
  {
    id: 'example-a',
    label: 'CDD',
    code: 'Context Driven Development:\n- context files define desired outcomes\n- next actions are E2E-testable\n- projects can be recreated from context only\n\nSee: /docs/cdd',
  },
  {
    id: 'example-b',
    label: 'Commands',
    code: 'Open the slash-command catalog:\n/docs/commands',
  },
  {
    id: 'example-c',
    label: 'Skills',
    code: 'Open shipped built-in skills:\n/docs/skills',
  },
] as const;

export function HeroTemplate() {
  const examples = useMemo(
    () =>
      HOME_TEMPLATE.examples.map((item, index) => ({
        id: item.id,
        label: item.label || FALLBACK_EXAMPLES[index]?.label || `Example ${index + 1}`,
        code: item.code || FALLBACK_EXAMPLES[index]?.code || '',
      })),
    [],
  );

  const [activeTab, setActiveTab] = useState(examples[0]?.id ?? 'example-a');
  const [copied, setCopied] = useState(false);

  const selectedExample = examples.find((item) => item.id === activeTab) ?? examples[0];
  const installCommand = HOME_TEMPLATE.installCommand || 'cargo install opennexus';

  async function handleCopyCommand() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="relative isolate flex flex-1 items-stretch overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.28),transparent_56%)]" />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 md:px-10 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-8 lg:py-20">
        <div className="space-y-7">
          <p className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-300">
            Nexus - CDD
          </p>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {HOME_TEMPLATE.headline || 'Context Driven Development'}
            </h1>
            <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">
              {HOME_TEMPLATE.description ||
                'OpenNexus installs a complete context-driven workflow into your repo: slash commands, rules, templates, and skill-ready llms.txt generation grounded in project context.'}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3 shadow-lg shadow-cyan-950/40">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">Quickstart</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-zinc-900 px-3 py-2 font-mono text-sm text-cyan-300">{installCommand}</code>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/10"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={HOME_TEMPLATE.primaryCtaHref || '/docs'}
              className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
            >
              {HOME_TEMPLATE.primaryCtaLabel || 'Open Documentation'}
            </Link>
            <Link
              href={HOME_TEMPLATE.secondaryCtaHref || 'https://github.com/Alpha-Innovation-Labs/opennexus'}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            >
              {HOME_TEMPLATE.secondaryCtaLabel || 'Repository'}
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/85 p-4 shadow-2xl shadow-cyan-950/50">
          <div className="mb-4 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  item.id === activeTab ? 'bg-cyan-300 text-zinc-950' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900 p-4">
            <code className="font-mono text-sm leading-6 text-zinc-100">{selectedExample?.code}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}
