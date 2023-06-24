<template>
  <q-card>
    <q-card-section>
      <q-tabs
        v-model="tab"
        class="text-primary"
        align="justify"
        indicator-color="primary"
        active-color="primary"
        shrink
      >
        <q-tab name="upload" label="Upload & Crop" />
        <q-tab name="results" label="Predict & Results" />
      </q-tabs>
      <q-separator />
      <q-tab-panels
        v-model="tab"
        :animated="false"
        :keep-alive="true"
        @transition="onTabChange"
      >
        <q-tab-panel name="upload">
          <q-file
            v-model="file"
            label="Upload blood sample grid image"
            accept="image/*"
            class="q-mb-md"
            :clearable="true"
            :filled="true"
          >
            <template v-slot:prepend>
              <q-icon name="cloud_upload" color="orange" />
            </template>
            <template v-slot:after>
              <q-btn label="Load Demo" @click="onLoadDemo" :flat="true"></q-btn>
            </template>
          </q-file>
          <div class="text-caption">
            After upload you can select a region of interest, click on the
            starting point of your grid square and hold and move the mouse to
            draw.
          </div>
          <div class="row justify-center full-height full-width">
            <canvas
              ref="canvasRaw"
              height="640"
              width="640"
              style="border: 1px solid #015f07"
            ></canvas>
          </div>
        </q-tab-panel>
        <q-tab-panel name="results">
          <div class="row justify-center full-height full-width">
            <div class="col-6 q-pr-xs">
              <q-btn
                label="Predict"
                color="primary"
                @click="onPredict"
                :loading="isLoading"
                :disable="!selectedRegion"
                style="width: 100%"
              />
              <div class="q-pt-xl q-pr-sm">
                <q-slider
                  v-model="scoreThreshold"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  :disable="!selectedRegion || isLoading"
                  :label-value="scoreThreshold + ' Score Threshold'"
                  :label-always="true"
                />
              </div>
              <div class="text-h4" v-if="!isLoading">
                Count: <b>{{ resultCount }}</b> <br />
                Results: [
                <span
                  v-for="(v, i) in resultCounts"
                  :key="i"
                  @click="onRemoveResult(i)"
                  style="cursor: pointer"
                >
                  <span v-if="i > 0">, </span> {{ v }}
                </span>
                ]
                <span>
                  <q-btn :inline="true" :flat="true" @click="onRemoveResult()">
                    Reset
                  </q-btn>
                </span>
                <br />
                Mean: <b>{{ resultMean.toFixed(2) }}</b>
              </div>
              <div v-else>
                <ol>
                  <li v-for="(item, index) in isLoadingItems" :key="index">
                    {{ item }}
                  </li>
                </ol>
              </div>
            </div>
            <div class="col-6 justify-center">
              <canvas
                ref="canvasCrop"
                width="640"
                height="640"
                style="border: 1px solid #000000"
              ></canvas>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import * as tf from '@tensorflow/tfjs';
import { getDistUrl } from 'src/utilities';
import { ref, watch } from 'vue';

const file = ref<File | null>(null);
const imageUrl = ref(new Image());
const tab = ref('upload');

const scoreThreshold = ref(0.5);
const resultCount = ref(0);
const resultCounts = ref<number[]>([]);
const resultMean = ref(0);
const isLoading = ref(false);
const isLoadingItems = ref<string[]>([]);

const modelUrl = getDistUrl() + '/models/cell-counter/model.json';
const canvasRaw = ref<HTMLCanvasElement | null>(null);
const canvasCrop = ref<HTMLCanvasElement | null>(null);
const selectedRegion = ref<HTMLCanvasElement | null>(null);
const selectedRegionChanged = ref(false);

watch(file, (newFile) => {
  if (newFile) {
    loadImage(newFile);
  }
});

watch(selectedRegion, (newRegion) => {
  if (newRegion) {
    selectedRegionChanged.value = true;
  }
});

const model = await init();

async function init() {
  const model = await tf.loadGraphModel(modelUrl);
  const temp = await model.executeAsync(tf.zeros([1, 640, 640, 3]));
  tf.dispose(temp);
  return model;
}

function loadImage(file: Blob | MediaSource) {
  imageUrl.value = new Image();
  imageUrl.value.src = URL.createObjectURL(file);
  imageUrl.value.onload = () => {
    if (canvasRaw.value) {
      const ctx = canvasRaw.value.getContext('2d');
      canvasRaw.value.width = imageUrl.value.width;
      canvasRaw.value.height = imageUrl.value.height;
      if (ctx) {
        ctx.drawImage(
          imageUrl.value,
          0,
          0,
          canvasRaw.value.width,
          canvasRaw.value.height
        );
      }
      enableDrawing(canvasRaw.value);
    } else {
      alert('Canvas not supported');
    }
  };
}

async function onLoadDemo() {
  const demoPath = getDistUrl() + '/demo/DemoCellsPlate.jpg';
  file.value = null;
  try {
    const response = await fetch(demoPath);
    const blob = await response.blob();
    loadImage(blob);
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

function onTabChange() {
  if (
    tab.value === 'results' &&
    selectedRegion.value &&
    selectedRegionChanged.value
  ) {
    selectedRegionChanged.value = false;
    cropToCanvas(selectedRegion.value);
  }
}
async function onPredict() {
  isLoadingItems.value = [];
  if (!model.inputs[0].shape) {
    alert('Model not loaded yet');
    return;
  }
  if (!canvasCrop.value) return;
  if (!selectedRegion.value) return;
  isLoading.value = true;
  isLoadingItems.value.push('Calculating tensor input...');

  cropToCanvas(selectedRegion.value);

  const c = canvasCrop.value;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;

  let [modelWidth, modelHeight] = model.inputs[0].shape.slice(1, 3);
  const input = tf.tidy(() => {
    return tf.image
      .resizeBilinear(tf.browser.fromPixels(c), [modelWidth, modelHeight])
      .div(255.0)
      .expandDims(0);
  });
  isLoadingItems.value.push('Predicting...');
  const output = (await model.executeAsync(input)) as
    | tf.Tensor<tf.Rank>[]
    | null;
  if (!output) {
    alert('Error running inference');
    isLoading.value = false;
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // 0: "detection_boxes", 1: "detection_scores", 2: "detection_classes", 3: "num_detections"
  const boxes = output[0].dataSync();
  const scores = output[1].dataSync();
  const validDetections = output[3].dataSync()[0];
  isLoadingItems.value.push('Post processing...');

  resultCount.value = 0;

  tf.dispose(output);

  for (let i = 0; i < validDetections; ++i) {
    let [x1, y1, x2, y2] = boxes.slice(i * 4, (i + 1) * 4);
    x1 *= c.width;
    x2 *= c.width;
    y1 *= c.height;
    y2 *= c.height;
    const width = x2 - x1;
    const height = y2 - y1;

    if (scores[i] < scoreThreshold.value) continue;
    resultCount.value++;
    const score = scores[i].toFixed(2);

    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 4;
    ctx.strokeRect(x1, y1, width, height);
    ctx.fillText(score, x1, y1);
  }

  resultCounts.value.push(resultCount.value);
  resultMean.value = calculateMean(resultCounts.value);

  isLoading.value = false;
}

function onRemoveResult(index: undefined | number = undefined) {
  if (!index) resultCounts.value = [];
  else resultCounts.value.splice(index, 1);
  resultMean.value = calculateMean(resultCounts.value);
}

function calculateMean(results: number[]) {
  if (results.length === 0) return 0;
  return results.reduce((x, y) => x + y) / results.length;
}

function cropToCanvas(image: HTMLImageElement | HTMLCanvasElement) {
  if (!canvasCrop.value) {
    alert('Canvas not supported');
    return;
  }
  const canvas = canvasCrop.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    alert('Canvas not supported');
    return;
  }

  const naturalWidth = image.width;
  const naturalHeight = image.height;

  // canvas.width = image.width;
  // canvas.height = image.height;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ratio = Math.min(
    canvas.width / image.width,
    canvas.height / image.height
  );
  const newWidth = Math.round(naturalWidth * ratio);
  const newHeight = Math.round(naturalHeight * ratio);
  ctx.drawImage(
    image,
    0,
    0,
    naturalWidth,
    naturalHeight,
    (canvas.width - newWidth) / 2,
    (canvas.height - newHeight) / 2,
    newWidth,
    newHeight
  );
}

function enableDrawing(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  let rect: DOMRect;
  let isDrawing = false;
  let startX: number, startY: number;
  let width: number, height: number;
  let absWidth: number, absHeight: number;
  let x: number, y: number;

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);

  canvas.addEventListener('touchstart', startTouch);
  canvas.addEventListener('touchmove', drawTouch);

  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseout', stop);
  canvas.addEventListener('touchend', stop);
  canvas.addEventListener('touchcancel', stop);

  function start(event: MouseEvent) {
    isDrawing = true;
    rect = canvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
  }

  function startTouch(event: TouchEvent) {
    event.preventDefault();
    isDrawing = true;
    rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    startX = touch.clientX - rect.left;
    startY = touch.clientY - rect.top;
  }

  function drawTouch(event: TouchEvent) {
    if (!isDrawing) return;
    const touch = event.touches[0];
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    drawSquare(currentX, currentY);
  }

  function draw(event: MouseEvent) {
    if (!isDrawing) return;

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    drawSquare(currentX, currentY);
  }

  function drawSquare(currentX: number, currentY: number) {
    width = Math.abs(currentX - startX); // Use absolute difference
    height = Math.abs(currentY - startY); // Use absolute difference

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    if (imageUrl.value) {
      if (imageUrl.value.src) {
        ctx.drawImage(imageUrl.value, 0, 0, canvas.width, canvas.height);
      }
    }

    x = currentX < startX ? currentX : startX; // Use the smaller value as x
    y = currentY < startY ? currentY : startY; // Use the smaller value as y
    absWidth = Math.abs(width);
    absHeight = Math.abs(height);

    // Draw the square outline
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, absWidth, absHeight);
  }

  function stop() {
    isDrawing = false;

    // Crop the background image to the square
    selectedRegion.value = document.createElement('canvas');
    const croppedCtx = selectedRegion.value.getContext('2d');
    if (!croppedCtx) {
      alert('Canvas not supported');
      return;
    }
    selectedRegion.value.width = width;
    selectedRegion.value.height = height;
    croppedCtx.drawImage(
      imageUrl.value,
      x,
      y,
      absWidth,
      absHeight,
      0,
      0,
      absWidth,
      absHeight
    );
  }
}
</script>
