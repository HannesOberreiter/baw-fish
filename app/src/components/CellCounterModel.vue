<template>
  <div class="q-pa-md">
    <div class="row">
    <div class="col">
      <div>
      <q-file
        v-model="file"
        label="Pick one file"
        filled
        accept="image/*"
        style="max-width: 300px"
      />
      </div>
      <div>
            <q-btn
        label="Predict"
        color="primary"
        @click="onPredict"
        :disable="!file"
      />
      </div>
      <div>
        Count: {{ resultCount }}
      </div>
    </div>
    <div class="col-10">

        <div>
      <canvas
        ref="canvasCrop"
        width="640"
        height="640"
        style="border: 1px solid #000000"
      ></canvas>
    </div>
    </div>
        </div>

  </div>

  <div class="flex">
    <div>
      <canvas
        ref="canvasRaw"
        width="640"
        height="640"
        style="border: 1px solid #000000"
      ></canvas>
    </div>

  </div>
</template>

<script setup lang="ts">
import * as tf from '@tensorflow/tfjs';
import {ref, watch } from 'vue';

const file = ref<File | null>(null);
const imageUrl = ref(new Image());

const resultCount = ref(0);

const modelUrl = '/models/cell-counter/model.json';
const canvasRaw = ref<HTMLCanvasElement | null>(null);
const canvasCrop = ref<HTMLCanvasElement | null>(null);

watch(file, (newFile) => {
  if (newFile) {
    imageUrl.value = new Image();
    imageUrl.value.src = URL.createObjectURL(newFile);
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
});

const model = await init();

async function init() {
  const model = await tf.loadGraphModel(modelUrl);
  const temp = await model.executeAsync(tf.zeros([1, 640, 640, 3]));
  tf.dispose(temp);
  return model;
}

async function onPredict() {
  if (!file.value) {
    alert('Please upload an image first');
    return;
  }
  if (!model.inputs[0].shape) {
    alert('Model not loaded yet');
    return;
  }
  if(!canvasCrop.value) return;
  const c = canvasCrop.value;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;

  let [modelWidth, modelHeight] = model.inputs[0].shape.slice(1, 3);
  const input = tf.tidy(() => {
    return tf.image
      .resizeBilinear(tf.browser.fromPixels(c), [modelWidth, modelHeight])
      .div(255.0)
      .expandDims(0);
  });

  const output = await model.executeAsync(input);
  if (!output) {
    return;
  }

  const [boxes, scores, _classes, valid_detections] =
    output as tf.Tensor<tf.Rank>[];
  const boxes_data = boxes.dataSync();
  const scores_data = scores.dataSync();
  const valid_detections_data = valid_detections.dataSync()[0];

  resultCount.value = valid_detections_data;

  tf.dispose(output);

  for (let i = 0; i < valid_detections_data; ++i) {
    let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
    x1 *= c.width;
    x2 *= c.width;
    y1 *= c.height;
    y2 *= c.height;
    const width = x2 - x1;
    const height = y2 - y1;
    const score = scores_data[i].toFixed(2);

    // Draw the bounding box.
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 4;
    ctx.strokeRect(x1, y1, width, height);

    // Draw the label background.
    ctx.fillStyle = '#00FFFF';
    const font = '16px sans-serif';

    const textWidth = ctx.measureText('class' + ':' + score).width;
    const textHeight = parseInt(font, 10); // base 10
    ctx.fillRect(x1, y1, textWidth + 4, textHeight + 4);
  }
  for (let i = 0; i < valid_detections_data; ++i) {
    let [x1, y1, ,] = boxes_data.slice(i * 4, (i + 1) * 4);
    x1 *= c.width;
    y1 *= c.height;
    const score = scores_data[i].toFixed(2);

    // Draw the text last to ensure it's on top.
    ctx.fillStyle = '#000000';
    ctx.fillText('cell' + ':' + score, x1, y1);
  }
}

function cropToCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
) {
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

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseout', stop);

  function start(event: MouseEvent) {
    isDrawing = true;
    rect = canvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
  }

  function draw(event: MouseEvent) {
    if (!isDrawing) return;

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const width = currentX - startX;
    const height = currentY - startY;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    if (imageUrl.value) {
      if (imageUrl.value.src) {
        ctx.drawImage(imageUrl.value, 0, 0, canvas.width, canvas.height);
      }
    }

        const x = width < 0 ? currentX : startX;
    const y = height < 0 ? currentY : startY;
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);

    // Draw the square outline
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, absWidth, absHeight);

    // Crop the background image to the square
    const selectedRegion = document.createElement('canvas');
    const croppedCtx = selectedRegion.getContext('2d');
    if (!croppedCtx) {
      alert('Canvas not supported');
      return;
    }
    selectedRegion.width = width;
    selectedRegion.height = height;
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
    cropToCanvas(selectedRegion)


  }

  function stop() {
    isDrawing = false;
  }
}
</script>
