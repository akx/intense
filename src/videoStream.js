export async function setupVideoStream(callback) {
  const streamContainer = document.createElement("div");
  const video = document.createElement("video");
  video.setAttribute("autoplay", "1");
  video.setAttribute("playsinline", "1");
  video.setAttribute("width", 1);
  video.setAttribute("height", 1);
  streamContainer.appendChild(video);
  document.body.appendChild(streamContainer);
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  const update = function () {
    callback(video);
    requestAnimationFrame(update);
  };
  update();
}
