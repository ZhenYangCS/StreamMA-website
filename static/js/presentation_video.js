/* Load the presentation only when a visitor chooses to watch it. */
(() => {
  const preview = document.querySelector('.presentation-video-preview');
  if (!preview) return;

  preview.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'none';
    video.width = 1920;
    video.height = 1080;
    video.poster = preview.querySelector('img').src;
    video.setAttribute('aria-label', 'StreamMA presentation');
    video.src = preview.href;
    preview.replaceWith(video);
    video.focus();
    video.play().catch(() => {
      // Keep native controls available if the browser requires another play gesture.
    });
  });
})();
