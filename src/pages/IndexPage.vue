<template>
  <q-page class="home-page">
    <div class="home-page__header">
      <h1 class="home-page__title">Sinpapel Designer</h1>
      <p class="home-page__subtitle">Configura workflows del framework sinpapel</p>
    </div>

    <div class="home-page__cards">
      <q-card
        class="home-page__card"
        clickable
        v-ripple
        @click="router.push({ name: 'workflows' })"
      >
        <q-card-section class="home-page__card-body">
          <q-icon name="account_tree" size="48px" class="home-page__icon" />
          <div class="home-page__card-title">Workflows</div>
          <div class="home-page__card-desc">
            Define flujos de aprobación, estados y transiciones
          </div>
        </q-card-section>
      </q-card>

      <q-card
        class="home-page__card"
        clickable
        v-ripple
        @click="router.push({ name: 'catalogos' })"
      >
        <q-card-section class="home-page__card-body">
          <q-icon name="category" size="48px" class="home-page__icon" />
          <div class="home-page__card-title">Catálogos</div>
          <div class="home-page__card-desc">
            Edita Estados, Etapas, Grupos y Tipos de Documento
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;700&display=swap');
</style>

<style scoped>
.home-page {
  padding: 40px 32px;
  background: #f7f3ef;
  min-height: 100vh;
  font-family: 'Cabin', sans-serif;
}

.home-page__header {
  margin-bottom: 40px;
}

.home-page__title {
  font-size: 28px;
  font-weight: 700;
  color: #9b2247;
  margin: 0 0 6px;
}

.home-page__subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.home-page__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
  max-width: 680px;
}

.home-page__card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8e0d8;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
}

.home-page__card:hover {
  box-shadow: 0 8px 24px rgba(155, 34, 71, 0.12);
  transform: translateY(-2px);
}

.home-page__card-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 24px 28px;
  gap: 12px;
}

.home-page__icon {
  color: #a57f2c;
}

.home-page__card-title {
  font-size: 18px;
  font-weight: 700;
  color: #9b2247;
}

.home-page__card-desc {
  font-size: 13px;
  color: #777;
  line-height: 1.5;
}
</style>
