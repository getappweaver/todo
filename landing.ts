import type { PluginLandingDefinition } from '../../apps/landing/content-types';

export const landingPage: PluginLandingDefinition = {
  route: '/apps/todo',
  name: 'Todo App',
  shortName: 'Todo',
  description:
    'Official AppWeaver Todo app. Adds focused AI-powered todo tools, commands, and data models to an AppWeaver workspace.',
  features: [
    'Create structured tasks from chat, web UI actions, or AI prompts.',
    'Focus on one part of the todo tree when you want to work in detail.',
    'Copy part of the tree structurally and paste it into any model you want to work with.',
    'AI agents cannot edit your todos directly; they create drafts that you can accept, revise, or decline.',
    'Your local todo app, accessible from anywhere you use AppWeaver.',
  ],
  hasInteractiveDemo: true,
  installScreenshot: 'landing/assets/todo-app.png',
  assetAliases: [
    {
      source: 'landing/assets/overview.png',
      publicPath: '/screenshots/todo.png',
    },
  ],
  demoStories: [
    {
      id: 'todo-add',
      label: 'Add todos',
      variants: [
        {
          view: 'desktop',
          src: 'landing/assets/todo-add.gif',
          alt: 'Todo app desktop view adding a todo from the widget',
          durationMs: 44380,
        },
        {
          view: 'mobile',
          src: 'landing/assets/todo-add-mobile.gif',
          alt: 'Todo app mobile view adding a todo from the widget',
          durationMs: 58380,
        },
      ],
    },
    {
      id: 'todo-add-by-ai',
      label: 'Create todos with AI',
      variants: [
        {
          view: 'desktop',
          src: 'landing/assets/todo-add-by-ai.gif',
          alt: 'Todo app creating tasks from an AI prompt',
          durationMs: 18760,
        },
        {
          view: 'mobile',
          src: 'landing/assets/todo-add-by-ai-mobile.gif',
          alt: 'Todo app mobile view creating tasks from an AI prompt',
          durationMs: 36760,
        },
      ],
    },
    {
      id: 'todo-duel',
      label: 'Prioritize with duels',
      variants: [
        {
          view: 'desktop',
          src: 'landing/assets/todo-duel.gif',
          alt: 'Todo app desktop view choosing between todos in a duel',
          durationMs: 37880,
        },
        {
          view: 'mobile',
          src: 'landing/assets/todo-duel-mobile.gif',
          alt: 'Todo app mobile view choosing between todos in a duel',
          durationMs: 50260,
        },
      ],
    },
  ],
  presentation: null,
  roadmapRepoId: 'todo',
};
