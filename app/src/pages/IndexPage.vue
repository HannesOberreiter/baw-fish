<template>
  <q-page>
    <h3>Cell Counter</h3>
    <div v-if="!hasWebGL">
      <q-banner class="bg-negative text-white">
        <h5>WebGL is not supported</h5>
        <p>This app requires WebGL to run. Please try a different browser.</p>
      </q-banner>
    </div>
    <div v-else>
      <Suspense>
        <CellCounterModel />
        <template #fallback>
          <q-spinner-hourglass color="purple" size="4em" />
        </template>
      </Suspense>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import CellCounterModel from 'components/CellCounterModel.vue';
import { onMounted, ref } from 'vue';

const hasWebGL = ref<boolean>(false);

onMounted(() => {
  hasWebGL.value = webgl_support();
});

function webgl_support() {
  try {
    var canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}
</script>
