const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('pages/IndexPage.vue') },
      // S27.4 T2 adds /workflow/:id route
      // S27.4 T3 adds /workflows route
    ],
  },
  // Catch-all 404 handled by Quasar default error page.
]

export default routes
