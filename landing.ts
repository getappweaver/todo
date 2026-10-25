import type { PluginLandingDefinition } from '../../apps/landing/content-types';

export const landingPage: PluginLandingDefinition = {
  route: '/apps/todo',
  name: 'Todo App',
  shortName: 'Todo',
  description:
    'Official AppWeaver Todo app. Adds focused AI-powered todo tools, commands, and data models to an AppWeaver workspace.',
  features: [],
  hasInteractiveDemo: false,
  installScreenshot: 'landing/assets/todo-app.png',
  assetAliases: [
    {
      source: 'landing/assets/overview.png',
      publicPath: '/screenshots/todo.png',
    },
  ],
  demoStories: [],
  presentation: null,
  roadmapRepoId: 'todo',
};
