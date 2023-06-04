<template>
  <q-layout view="hHh lpR fFf">
    <q-header bordered class="bg-primary text-white" height-hint="98">
      <q-tabs align="left">
        <q-route-tab to="/" label="Home" />
        <q-route-tab to="/blood-cells-counter" label="Blood Cells Counter" />
        <q-route-tab to="/fish-eggs-counter" label="Fish Eggs Counter" />
      </q-tabs>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
