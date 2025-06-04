const radialProgress = document.querySelector(".RadialProgress");
const loaderOverlay = document.getElementById("loader-overlay");

let fakeProgress = 0;
let actualDone = false;
let startTime = performance.now();

const updateProgress = (value) => {
  radialProgress.style.setProperty("--progress", `${value}%`);
  radialProgress.innerHTML = `${value}%`;
  radialProgress.setAttribute("aria-valuenow", value);
};

const animateFakeProgress = () => {
  const now = performance.now();
  const elapsed = now - startTime;

  // Progress from 0 to 99% over real page load duration
  const estTotalLoadTime = Math.max(300, elapsed + 200); // estimate load time
  const progress = Math.min(99, Math.floor((elapsed / estTotalLoadTime) * 100));

  if (progress > fakeProgress) {
    fakeProgress = progress;
    updateProgress(fakeProgress);
  }

  if (!actualDone) {
    requestAnimationFrame(animateFakeProgress);
  } else if (fakeProgress < 100) {
    fakeProgress++;
    updateProgress(fakeProgress);
    requestAnimationFrame(animateFakeProgress);
  } else {
    hideLoader();
  }
};

const hideLoader = () => {
  loaderOverlay.classList.add("hidden");
  setTimeout(() => {
    loaderOverlay.remove();
  }, 800);
};

// When real page load completes
window.addEventListener("load", () => {
  actualDone = true;
});

// Start animation immediately
requestAnimationFrame(animateFakeProgress);
