import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/document/index',
  },
  {
    path: '/document',
    redirect: '/document/index',
  },
  {
    path: '/document/index',
    name: 'DocumentList',
    component: () => import('@/views/document/index.vue'),
  },
  {
    path: '/document/templates',
    name: 'TemplateList',
    component: () => import('@/views/document/templates.vue'),
  },
  {
    path: '/document-edit/:id',
    name: 'DocumentEdit',
    component: () => import('@/views/document/edit.vue'),
  },
  {
    path: '/template-edit/:id',
    name: 'TemplateEdit',
    component: () => import('@/views/document/templateEdit.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/document/index',
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
