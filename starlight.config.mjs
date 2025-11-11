import { defineConfig } from '@astrojs/starlight/config';

export default defineConfig({
  title: 'RFP Agent Documentation',
  description: 'Unified platform, workflow, and operations documentation for the RFP Agent system.',
  site: 'https://docs.rfpagent.example.com',
  social: {
    github: 'https://github.com/VerticalLabs-ai/rfpagent'
  },
  lastUpdated: true,
  tableOfContents: {
    minHeadingLevel: 2,
    maxHeadingLevel: 4
  },
  editLink: {
    baseUrl: 'https://github.com/VerticalLabs-ai/rfpagent/edit/main/docs/src/content/docs'
  },
  sidebar: [
    {
      label: 'Overview',
      items: [
        { label: 'Welcome', link: '/index' },
        { label: 'Governance', link: '/governance/overview' },
        { label: 'Changelog Process', link: '/governance/changelog-discipline' }
      ]
    },
    {
      label: 'Platform',
      items: [
        { label: 'System Architecture', link: '/platform/architecture-overview' },
        { label: 'Subsystem Coverage Map', link: '/platform/repository-audit-map' }
      ]
    },
    {
      label: 'Workflows & Agents',
      items: [
        { label: 'Agent Orchestration', link: '/workflows/agent-orchestration' },
        { label: 'Workflow Catalogue', link: '/workflows/workflow-catalogue' }
      ]
    },
    {
      label: 'Operations',
      items: [
        { label: 'CI/CD & Deployments', link: '/operations/ci-and-deployment' },
        { label: 'Observability & Runbooks', link: '/operations/observability-runbooks' }
      ]
    },
    {
      label: 'Quality & Testing',
      items: [
        { label: 'Testing Strategy', link: '/quality/testing-overview' },
        { label: 'Performance Optimization', link: '/quality/performance-optimization' }
      ]
    },
    {
      label: 'Reference',
      items: [
        { label: 'API Reference', link: '/reference/api-index' },
        { label: 'Component Library', link: '/reference/storybook-integration' },
        { label: 'TypeDoc API', link: '/reference/typedoc-index' }
      ]
    },
    {
      label: 'Legacy Archive',
      items: [
        { label: 'AI-Generated Backlog', link: '/legacy/ai-generated-backlog' },
        { label: 'Cleanup Manifest', link: '/legacy/cleanup-roadmap' }
      ]
    }
  ],
  plugins: [],
  customCss: ['./src/styles/theme.css']
});
