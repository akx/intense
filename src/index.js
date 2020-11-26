// Adapted from https://github.com/nenadmarkus/picojs/blob/master/examples/webcam.html

import "./index.css";
import * as pico from "./picojs/pico";
import * as lploc from "./picojs/lploc";
import { setupVideoStream } from "./videoStream";

function rgbaToGrayscale(rgba, nrows, ncols) {
  const gray = new Uint8Array(nrows * ncols);
  for (var r = 0; r < nrows; ++r) {
    for (var c = 0; c < ncols; ++c) {
      const offset = r * 4 * ncols + 4 * c;
      // gray = 0.2*red + 0.7*green + 0.1*blue
      gray[r * ncols + c] =
        (2 * rgba[offset] + 7 * rgba[offset + 1] + 1 * rgba[offset + 2]) / 10;
    }
  }
  return gray;
}

async function loadCascade(src) {
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  const bytes = new Int8Array(buf);
  return pico.unpack_cascade(bytes);
}

async function loadPuploc(src) {
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  const bytes = new Int8Array(buf);
  return lploc.unpack_localizer(bytes);
}

let facefinder_classify_region, do_puploc, eyesImage, ctx;
let update_memory = pico.instantiate_detection_memory(5);

const params = {
  shiftfactor: 0.1, // move the detection window by 10% of its size
  minsize: 100, // minimum size of a face
  maxsize: 1000, // maximum size of a face
  scalefactor: 1.1, // for multiscale processing: resize the detection window by 10% when moving to the higher scale
};

const WIDTH = 640;
const HEIGHT = 480;

function findEyes(det, image, xOff, yOff) {
  let r, c, s;
  r = det[0] - yOff * det[2];
  c = det[1] - xOff * det[2];
  s = 0.35 * det[2];
  const e1 = do_puploc(r, c, s, 63, image);
  r = det[0] - yOff * det[2];
  c = det[1] + xOff * det[2];
  s = 0.35 * det[2];
  const e2 = do_puploc(r, c, s, 63, image);
  return [e1, e2];
}

function processDetection(image, det) {
  if (det[3] <= 50.0) {
    return;
  }
  const eyes = findEyes(det, image, 0.175, 0.075).filter(
    ([r, c]) => r >= 0 && c >= 0
  );
  // ctx.beginPath();
  // ctx.arc(det[1], det[0], det[2] / 2, 0, 2 * Math.PI, false);
  // ctx.lineWidth = 3;
  // ctx.strokeStyle = "red";
  // ctx.stroke();
  // eyes.forEach(([r, c]) => {
  //   ctx.beginPath();
  //   ctx.arc(c, r, 1, 0, 2 * Math.PI, false);
  //   ctx.lineWidth = 3;
  //   ctx.strokeStyle = "red";
  //   ctx.stroke();
  // });
  if (eyes.length === 2) {
    const [y0, x0] = eyes[0];
    const [y1, x1] = eyes[1];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const ds = Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2);
    const an = Math.atan2(y1 - y0, x1 - x0);
    const scale = Math.min(3, ds / (eyesImage.width / 2));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.rotate(an);
    ctx.drawImage(eyesImage, eyesImage.width * -0.5, eyesImage.height * -0.5);
    ctx.restore();
  }
}

function processFrame(video) {
  if (!(facefinder_classify_region && do_puploc && ctx && eyesImage)) {
    return;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(video, 0, 0);
  const rgba = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
  const image = {
    pixels: rgbaToGrayscale(rgba, HEIGHT, WIDTH),
    nrows: HEIGHT,
    ncols: WIDTH,
    ldim: WIDTH,
  };
  let dets = pico.run_cascade(image, facefinder_classify_region, params);
  dets = update_memory(dets);
  dets = pico.cluster_detections(dets, 0.2); // set IoU threshold to 0.2
  dets.forEach((det) => processDetection(image, det));
}

function loadEyesImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

async function boot() {
  const canvas = document.createElement("canvas");
  canvas.id = "c";
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  [facefinder_classify_region, do_puploc, eyesImage] = await Promise.all([
    loadCascade("data/facefinder.cascade"),
    loadPuploc("data/puploc.bin"),
    loadEyesImage("data/eyes.png"),
    setupVideoStream(processFrame),
  ]);
}

boot();
