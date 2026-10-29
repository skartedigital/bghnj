const video = document.getElementById("video");
const filterCanvas = document.getElementById("filterCanvas");
const overlay = document.getElementById("overlay");
const canvas = document.getElementById("canvas");
const recordingCanvas = document.getElementById("recordingCanvas");

const captureBtn = document.getElementById("capture");
const switchCameraBtn = document.getElementById("switch-camera");
const filterButtons = document.querySelectorAll(".filter-option");

const previewContainer = document.getElementById("preview-container");
const photoPreview = document.getElementById("photo-preview");
const saveBtn = document.getElementById("save-btn");
const retryBtn = document.getElementById("retry-btn");
const instructions = document.getElementById("instructions");

const startRecordBtn = document.getElementById("start-recording");
const stopRecordBtn = document.getElementById("stop-recording");
const recordingIndicator = document.getElementById("recording-indicator");

const videoPreviewContainer = document.getElementById("video-preview-container");
const videoPreview = document.getElementById("video-preview");
const saveVideoBtn = document.getElementById("save-video-btn");
const videoInstructions = document.getElementById("video-instructions");
const loadingMessage = document.getElementById("loading-message");

let stream = null;
let usingFrontCamera = true;
let selectedFilter = "normal";

let mediaRecorder = null;
let recordedChunks = [];
let recordedMimeType = "video/webm";
let lastVideoUrl = null;

let isRecording = false;
let recordStartTime = 0;
let recordTimerInterval = null;


/* =====================================================
   4 OPÇÕES
   ===================================================== */

const FILTERS = {

  normal: {
    brightness: 1.00,
    contrast: 1.00,
    saturation: 1.00,
    blur: 0,
    color: null,
    alpha: 0,
    glow: 0
  },

  bright: {
    brightness: 1.34,
    contrast: 1.08,
    saturation: 1.12,
    blur: 2.8,
    color: "#FFF0DD",
    alpha: 0.20,
    glow: 0.16
  },

  warm: {
    brightness: 1.18,
    contrast: 1.12,
    saturation: 1.30,
    blur: 2.2,
    color: "#FF8B38",
    alpha: 0.30,
    glow: 0.05
  },

  cool: {
    brightness: 1.08,
    contrast: 1.14,
    saturation: 1.16,
    blur: 1.8,
    color: "#7FAFFF",
    alpha: 0.28,
    glow: 0.04
  }

};


/* =====================================================
   SELEÇÃO
   ===================================================== */

filterButtons.forEach(button => {

  button.addEventListener("click", () => {

    selectedFilter = button.dataset.filter;

    filterButtons.forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.filter === selectedFilter
      );
    });

  });

});


/* =====================================================
   TAMANHO DA CÂMERA
   ===================================================== */

function getVideoSize() {

  const track =
    stream?.getVideoTracks?.()[0];

  const settings =
    track?.getSettings?.() || {};

  return {
    width:
      settings.width ||
      video.videoWidth ||
      1280,

    height:
      settings.height ||
      video.videoHeight ||
      720
  };

}


/* =====================================================
   PREPARAR CANVAS
   ===================================================== */

function prepareCanvas(c, width, height) {

  if (
    c.width !== width ||
    c.height !== height
  ) {
    c.width = width;
    c.height = height;
  }

}


/* =====================================================
   DESENHAR CÂMERA
   ===================================================== */

function drawCamera(ctx, width, height, mirror) {

  ctx.save();

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(
    video,
    0,
    0,
    width,
    height
  );

  ctx.restore();

}


/* =====================================================
   DESENHAR FILTRO
   ===================================================== */

function drawFilteredFrame(
  targetCanvas,
  width,
  height,
  mirror
) {

  const ctx =
    targetCanvas.getContext("2d");

  const filter =
    FILTERS[selectedFilter];

  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /* NORMAL */

  if (selectedFilter === "normal") {

    drawCamera(
      ctx,
      width,
      height,
      mirror
    );

    return;
  }


  /* EFEITO PRINCIPAL */

  ctx.save();

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter =
    `blur(${filter.blur}px)
     brightness(${filter.brightness})
     contrast(${filter.contrast})
     saturate(${filter.saturation})`;

  ctx.drawImage(
    video,
    0,
    0,
    width,
    height
  );

  ctx.filter = "none";

  ctx.restore();


  /* COR DO FILTRO */

  if (
    filter.color &&
    filter.alpha > 0
  ) {

    ctx.save();

    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.globalCompositeOperation =
      "soft-light";

    ctx.globalAlpha =
      filter.alpha;

    ctx.fillStyle =
      filter.color;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.restore();
  }


  /* LUZ EXTRA */

  if (filter.glow > 0) {

    ctx.save();

    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.globalCompositeOperation =
      "screen";

    ctx.globalAlpha =
      filter.glow;

    ctx.fillStyle =
      "#FFF7EC";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.restore();
  }

}


/* =====================================================
   RENDERIZAÇÃO AO VIVO
   ===================================================== */

function renderFilter() {

  if (
    stream &&
    video.readyState >= 2
  ) {

    const size =
      getVideoSize();

    prepareCanvas(
      filterCanvas,
      size.width,
      size.height
    );

    drawFilteredFrame(
      filterCanvas,
      size.width,
      size.height,
      usingFrontCamera
    );
  }

  requestAnimationFrame(
    renderFilter
  );

}


/* =====================================================
   CÂMERA
   ===================================================== */

async function startCamera() {

  try {

    if (stream) {

      stream
        .getTracks()
        .forEach(track => track.stop());

    }

    loadingMessage.style.display =
      "block";

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          facingMode:
            usingFrontCamera
              ? "user"
              : "environment",

          width: {
            ideal: 1920
          },

          height: {
            ideal: 1080
          }
        },

        audio: true

      });


    video.srcObject =
      stream;


    video.style.transform =
      usingFrontCamera
        ? "scaleX(-1)"
        : "scaleX(1)";


    await video.play();


    loadingMessage.style.display =
      "none";


  } catch (error) {

    console.error(error);

    loadingMessage.style.display =
      "none";

    alert(
      "Não foi possível acessar a câmera. Permita o acesso à câmera e ao microfone."
    );

  }

}


/* =====================================================
   TROCAR CÂMERA
   ===================================================== */

switchCameraBtn.addEventListener(
  "click",
  async () => {

    usingFrontCamera =
      !usingFrontCamera;

    await startCamera();

  }
);


/* =====================================================
   FOTO
   ===================================================== */

captureBtn.addEventListener(
  "click",
  () => {

    if (
      !stream ||
      video.readyState < 2
    ) {
      return;
    }

    const size =
      getVideoSize();

    prepareCanvas(
      canvas,
      size.width,
      size.height
    );


    drawFilteredFrame(
      canvas,
      size.width,
      size.height,
      usingFrontCamera
    );


    const ctx =
      canvas.getContext("2d");


    ctx.drawImage(
      overlay,
      0,
      0,
      size.width,
      size.height
    );


    photoPreview.src =
      canvas.toDataURL("image/png");


    previewContainer.style.display =
      "flex";

  }
);


/* =====================================================
   SALVAR FOTO
   ===================================================== */

saveBtn.addEventListener(
  "click",
  () => {

    const link =
      document.createElement("a");

    link.download =
      "foto-cerejinha.png";

    link.href =
      photoPreview.src;

    link.click();

    if (
      /iPhone|iPad|iPod/i.test(
        navigator.userAgent
      )
    ) {
      instructions.style.display =
        "block";
    }

  }
);


/* =====================================================
   TIRAR OUTRA
   ===================================================== */

retryBtn.addEventListener(
  "click",
  () => {

    previewContainer.style.display =
      "none";

    instructions.style.display =
      "none";

  }
);


/* =====================================================
   TIMER
   ===================================================== */

function startRecordingTimer() {

  recordStartTime =
    Date.now();

  recordingIndicator.style.display =
    "block";

  recordingIndicator.textContent =
    "🔴 REC 00:00";


  recordTimerInterval =
    setInterval(() => {

      const seconds =
        Math.floor(
          (Date.now() - recordStartTime) /
          1000
        );

      const minutes =
        String(
          Math.floor(seconds / 60)
        ).padStart(2, "0");

      const rest =
        String(
          seconds % 60
        ).padStart(2, "0");

      recordingIndicator.textContent =
        `🔴 REC ${minutes}:${rest}`;

    }, 500);

}


function stopRecordingTimer() {

  clearInterval(
    recordTimerInterval
  );

  recordTimerInterval =
    null;

  recordingIndicator.style.display =
    "none";

}


/* =====================================================
   GRAVAR VÍDEO
   ===================================================== */

function startVideoRecording() {

  if (
    !stream ||
    isRecording
  ) {
    return;
  }


  const size =
    getVideoSize();


  const targetWidth =
    640;

  const targetHeight =
    Math.round(
      size.height *
      targetWidth /
      size.width
    );


  recordingCanvas.width =
    targetWidth;

  recordingCanvas.height =
    targetHeight;


  const rctx =
    recordingCanvas.getContext("2d");


  isRecording =
    true;

  recordedChunks =
    [];


  videoPreviewContainer.style.display =
    "none";


  function drawRecordingFrame() {

    if (!isRecording) {
      return;
    }


    drawFilteredFrame(
      recordingCanvas,
      targetWidth,
      targetHeight,
      usingFrontCamera
    );


    rctx.drawImage(
      overlay,
      0,
      0,
      targetWidth,
      targetHeight
    );


    requestAnimationFrame(
      drawRecordingFrame
    );

  }


  drawRecordingFrame();


  const videoStream =
    recordingCanvas.captureStream(24);


  const combinedStream =
    new MediaStream();


  videoStream
    .getVideoTracks()
    .forEach(track => {
      combinedStream.addTrack(track);
    });


  stream
    .getAudioTracks()
    .forEach(track => {
      combinedStream.addTrack(track);
    });


  const ios =
    /iPhone|iPad|iPod/i.test(
      navigator.userAgent
    );


  let options = {};

  recordedMimeType =
    "video/webm";


  try {

    if (
      ios &&
      MediaRecorder.isTypeSupported(
        "video/mp4"
      )
    ) {

      options.mimeType =
        "video/mp4";

      recordedMimeType =
        "video/mp4";

    } else if (
      MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp9,opus"
      )
    ) {

      options.mimeType =
        "video/webm;codecs=vp9,opus";

    } else if (
      MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp8,opus"
      )
    ) {

      options.mimeType =
        "video/webm;codecs=vp8,opus";

    }


    mediaRecorder =
      new MediaRecorder(
        combinedStream,
        options
      );


  } catch (error) {

    isRecording =
      false;

    alert(
      "Seu navegador não suporta a gravação de vídeo."
    );

    return;

  }


  mediaRecorder.ondataavailable =
    event => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordedChunks.push(
          event.data
        );

      }

    };


  mediaRecorder.onstop =
    () => {

      isRecording =
        false;


      const blob =
        new Blob(
          recordedChunks,
          {
            type:
              recordedMimeType
          }
        );


      if (lastVideoUrl) {
        URL.revokeObjectURL(
          lastVideoUrl
        );
      }


      lastVideoUrl =
        URL.createObjectURL(blob);


      videoPreview.src =
        lastVideoUrl;


      videoPreview.load();


      videoPreviewContainer.style.display =
        "flex";


      startRecordBtn.style.display =
        "inline-block";

      stopRecordBtn.style.display =
        "none";

    };


  mediaRecorder.start();

  startRecordingTimer();


  startRecordBtn.style.display =
    "none";

  stopRecordBtn.style.display =
    "inline-block";

}


/* =====================================================
   BOTÕES DE VÍDEO
   ===================================================== */

startRecordBtn.addEventListener(
  "click",
  startVideoRecording
);


stopRecordBtn.addEventListener(
  "click",
  () => {

    if (
      mediaRecorder &&
      mediaRecorder.state ===
        "recording"
    ) {

      isRecording =
        false;

      mediaRecorder.stop();

      stopRecordingTimer();

    }

  }
);


/* =====================================================
   SALVAR VÍDEO
   ===================================================== */

saveVideoBtn.addEventListener(
  "click",
  () => {

    if (!lastVideoUrl) {
      return;
    }


    const link =
      document.createElement("a");


    link.href =
      lastVideoUrl;


    link.download =
      recordedMimeType === "video/mp4"
        ? "video-cerejinha.mp4"
        : "video-cerejinha.webm";


    link.click();


    if (
      /iPhone|iPad|iPod/i.test(
        navigator.userAgent
      )
    ) {

      videoInstructions.style.display =
        "block";

    }

  }
);


/* =====================================================
   INICIAR
   ===================================================== */

startCamera();
renderFilter();
