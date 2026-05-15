<template>
  <q-layout view="lHh Lpr lFf">

    <!-- Header superior -->
    <q-header class="ds-header">
      <q-toolbar class="ds-toolbar">
        <button class="ds-menu-btn" @click="leftDrawerOpen = !leftDrawerOpen" aria-label="Menú">
          <q-icon name="menu" size="20px" />
        </button>

        <div class="ds-toolbar__brand">
          <div class="ds-toolbar__sigla">Diseñador</div>
          <div class="ds-toolbar__name">Sinpapel Workflow Designer</div>
        </div>

        <q-space />

        <router-link to="/" class="ds-toolbar__back-btn">
          <q-icon name="arrow_back" size="16px" />
          Inicio
        </router-link>
      </q-toolbar>
    </q-header>

    <!-- Drawer lateral -->
    <q-drawer v-model="leftDrawerOpen" show-if-above class="ds-drawer">

      <!-- Marca en el drawer -->
      <div class="ds-drawer__brand">
        <div class="ds-drawer__brand-icon">
          <q-icon name="design_services" size="22px" />
        </div>
        <div class="ds-drawer__brand-text">
          <div class="ds-drawer__brand-sigla">Diseñador</div>
          <div class="ds-drawer__brand-sub">Sinpapel framework</div>
        </div>
      </div>

      <!-- Separador -->
      <div class="ds-drawer__divider"></div>

      <!-- Label sección -->
      <div class="ds-drawer__section-label">Menú principal</div>

      <!-- Links de navegación (Productos dropped per D5: dominio créditos) -->
      <div class="ds-drawer__nav">
        <router-link :to="{ name: 'workflows' }" class="ds-nav-item" active-class="ds-nav-item--active">
          <div class="ds-nav-item__icon">
            <q-icon name="account_tree" size="20px" />
          </div>
          <div class="ds-nav-item__text">
            <span class="ds-nav-item__title">Workflows</span>
            <span class="ds-nav-item__caption">Flujos de aprobación</span>
          </div>
        </router-link>

        <router-link :to="{ name: 'catalogos' }" class="ds-nav-item" active-class="ds-nav-item--active">
          <div class="ds-nav-item__icon">
            <q-icon name="category" size="20px" />
          </div>
          <div class="ds-nav-item__text">
            <span class="ds-nav-item__title">Catálogos</span>
            <span class="ds-nav-item__caption">Estados, Etapas, Grupos</span>
          </div>
        </router-link>
      </div>

      <!-- Footer del drawer -->
      <div class="ds-drawer__footer">
        <router-link to="/" class="ds-drawer__back-link">
          <q-icon name="arrow_back" size="15px" />
          Volver al inicio
        </router-link>
      </div>

    </q-drawer>

    <!-- Contenido -->
    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
const leftDrawerOpen = ref(false)
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;700&display=swap');
</style>

<style scoped>
/* ─── Header ─── */
.ds-header {
  background: linear-gradient(135deg, var(--sp-primary) 0%, var(--sp-primary-darker) 100%) !important;
  border-bottom: 3px solid var(--sp-secondary);
}

.ds-toolbar {
  padding: 0 12px;
  min-height: 56px;
  font-family: 'Cabin', sans-serif;
}

.ds-menu-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(165, 127, 44, 0.3);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
  margin-right: 12px;
}

.ds-menu-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.ds-toolbar__brand {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.ds-toolbar__sigla {
  font-size: 18px;
  font-weight: 700;
  color: var(--sp-secondary);
  font-family: 'Cabin', sans-serif;
  letter-spacing: 0.5px;
}

.ds-toolbar__name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-family: 'Cabin', sans-serif;
  letter-spacing: 0.3px;
  margin-top: 1px;
}

@media (max-width: 600px) {
  .ds-toolbar__name { display: none; }
}

.ds-toolbar__back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background 0.13s, color 0.13s;
}

.ds-toolbar__back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ─── Drawer ─── */
.ds-drawer {
  background: #fff !important;
  border-right: 1px solid #e0d8cc !important;
  font-family: 'Cabin', sans-serif;
}

.ds-drawer__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  background: linear-gradient(135deg, var(--sp-primary), var(--sp-primary-darker));
  border-bottom: 3px solid var(--sp-secondary);
}

.ds-drawer__brand-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(165, 127, 44, 0.25);
  color: var(--sp-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ds-drawer__brand-sigla {
  font-size: 16px;
  font-weight: 700;
  color: var(--sp-secondary);
  font-family: 'Cabin', sans-serif;
}

.ds-drawer__brand-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Cabin', sans-serif;
  margin-top: 1px;
}

.ds-drawer__divider {
  height: 1px;
  background: #e0d8cc;
  margin: 8px 0 4px;
}

.ds-drawer__section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #b0a090;
  padding: 4px 20px 6px;
  font-family: 'Cabin', sans-serif;
}

/* Nav items */
.ds-drawer__nav {
  padding: 0 8px;
}

.ds-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 2px;
  text-decoration: none;
  color: #4a3830;
  transition: background 0.13s;
}

.ds-nav-item:hover {
  background: #fdf3f6;
}

.ds-nav-item__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #f5eae8;
  color: var(--sp-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.13s;
}

.ds-nav-item__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ds-nav-item__title {
  font-family: 'Cabin', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #161a1d;
}

.ds-nav-item__caption {
  font-family: 'Cabin', sans-serif;
  font-size: 11px;
  color: #9a8a7a;
}

.ds-nav-item--active {
  background: #fdf0f4 !important;
}

.ds-nav-item--active .ds-nav-item__icon {
  background: #9b2247;
  color: #e6d194;
}

.ds-nav-item--active .ds-nav-item__title {
  color: var(--sp-primary);
}

/* Footer */
.ds-drawer__footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  border-top: 1px solid #e0d8cc;
  background: #fdfbf6;
}

.ds-drawer__back-link {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border-radius: 8px;
  background: transparent;
  border: 1.5px solid #e0d5cc;
  color: #7a6e66;
  font-family: 'Cabin', sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  justify-content: center;
  transition: all 0.13s;
}

.ds-drawer__back-link:hover {
  background: #f5eae8;
  border-color: var(--sp-secondary);
  color: #161a1d;
}
</style>
