import { renderMasterLayout } from './layout';

interface App {
  name: string;
  description: string;
  url: string;
  icon: string;
  status: 'live' | 'beta' | 'soon';
}

const APPS: App[] = [
  {
    name: 'Link Shortener',
    description: 'Create short, trackable links with analytics, QR codes, and custom aliases.',
    url: 'https://l.m-space.in',
    icon: '🔗',
    status: 'live',
  },
  {
    name: 'Auto Blog',
    description: 'AI-curated content pipeline — sourced, rewritten, and published automatically.',
    url: '/blog',
    icon: '✍️',
    status: 'beta',
  },
  {
    name: 'Events',
    description: 'Community events, volunteer coordination, and attendance management.',
    url: '/events',
    icon: '📅',
    status: 'soon',
  },
];

function statusBadge(status: App['status']): string {
  const map = {
    live: 'bg-green-100 text-green-700',
    beta: 'bg-amber-100 text-amber-700',
    soon: 'bg-gray-100 text-gray-500',
  };
  return `<span class="text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}">${status === 'soon' ? 'Coming soon' : status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

export function renderMasterHome(): string {
  const children = `
    <!-- Hero -->
    <section class="bg-white border-b border-gray-100">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
          A platform for <span class="text-brand">community</span>
        </h1>
        <p class="text-lg text-gray-500 max-w-xl mx-auto mb-8">
          mSpace brings together tools for sharing, learning, and collaborating — built for people, not algorithms.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/join" class="bg-brand hover:bg-green-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
            Request an invite
          </a>
          <a href="/about" class="border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition-colors">
            Learn more
          </a>
        </div>
      </div>
    </section>

    <!-- Apps -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <h2 class="text-xl font-semibold text-gray-900 mb-8">Platform apps</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${APPS.map(app => `
          <a href="${app.status !== 'soon' ? app.url : '#'}"
             class="group block bg-white border border-gray-200 rounded-xl p-6 hover:border-brand hover:shadow-sm transition-all ${app.status === 'soon' ? 'opacity-60 cursor-default' : ''}">
            <div class="flex items-start justify-between mb-3">
              <span class="text-2xl">${app.icon}</span>
              ${statusBadge(app.status)}
            </div>
            <h3 class="font-semibold text-gray-900 mb-1 group-hover:text-brand transition-colors">${app.name}</h3>
            <p class="text-sm text-gray-500 leading-relaxed">${app.description}</p>
          </a>
        `).join('')}
      </div>
    </section>

    <!-- Invite CTA -->
    <section class="bg-brand/5 border-t border-brand/10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
        <h2 class="text-2xl font-bold text-gray-900 mb-3">Invite-only for now</h2>
        <p class="text-gray-500 mb-6 max-w-md mx-auto">
          mSpace is in early access. If you'd like to contribute or collaborate, reach out or apply to volunteer.
        </p>
        <a href="/volunteers" class="inline-block border border-brand text-brand hover:bg-brand hover:text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
          Get involved
        </a>
      </div>
    </section>
  `;

  return renderMasterLayout({ title: 'Home', children });
}
