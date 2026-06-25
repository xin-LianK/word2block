<template>
  <div class="legacy-shell">
    <header class="legacy-shell-header">
      <RouterLink class="legacy-shell-brand" to="/document/index">旧版文档管理</RouterLink>
      <nav class="legacy-shell-nav" aria-label="主导航">
        <RouterLink to="/document/index">文档列表</RouterLink>
        <RouterLink to="/document/templates">模板列表</RouterLink>
      </nav>
    </header>
    <main class="legacy-shell-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.legacy-shell {
  min-height: 100vh;
}

.legacy-shell-header {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 56px;
  padding: 0 28px;
  border-bottom: 1px solid var(--c-border);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.legacy-shell-brand {
  color: var(--c-text);
  font-size: 16px;
  font-weight: 700;
}

.legacy-shell-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legacy-shell-nav a {
  min-width: 86px;
  padding: 7px 14px;
  border-radius: 6px;
  color: var(--c-text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

.legacy-shell-nav a:hover {
  color: var(--c-primary);
  background: #eff6ff;
}

.legacy-shell-nav a.router-link-active {
  color: #1d4ed8;
  background: #dbeafe;
}

.legacy-shell-main {
  min-height: calc(100vh - 56px);
}

@media (max-width: 640px) {
  .legacy-shell-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
  }

  .legacy-shell-nav {
    width: 100%;
  }

  .legacy-shell-nav a {
    flex: 1;
  }
}
</style>
