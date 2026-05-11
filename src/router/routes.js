const routes = [
  {
    path: '/',
    component: () => import('pages/IndexPage.vue'),
  },
  // Catch-all 404 handled by Quasar default error page.
]

export default routes
