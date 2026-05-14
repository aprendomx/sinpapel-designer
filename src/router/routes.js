const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/IndexPage.vue') },
      { path: 'workflows', name: 'workflows', component: () => import('pages/WorkflowListPage.vue') },
      { path: 'workflow/:id', name: 'workflow-canvas', component: () => import('pages/WorkflowCanvasPage.vue') },
      { path: 'catalogos', name: 'catalogos', component: () => import('pages/CatalogosPage.vue') },
    ],
  },
  // Catch-all 404 handled by Quasar default error page.
]

export default routes
