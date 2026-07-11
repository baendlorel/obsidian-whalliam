import type { ProviderWorkspaceServices, ProviderWorkspaceRegistration, ProviderTabWarmupPolicy, ProviderWorkspaceInitContext } from '../../../core/providers/types';

const warmupPolicy: ProviderTabWarmupPolicy = {
  resolveMode: (ctx) => ctx.tab.lifecycleState === 'blank' ? 'none' : 'runtime',
};

const codewhaleWorkspace: ProviderWorkspaceServices = {
  tabWarmupPolicy: warmupPolicy,
};

export const codewhaleWorkspaceRegistration: ProviderWorkspaceRegistration = {
  initialize: async (_ctx: ProviderWorkspaceInitContext): Promise<ProviderWorkspaceServices> => {
    return codewhaleWorkspace;
  },
};