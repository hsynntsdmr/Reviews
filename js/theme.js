// Tema, ilk boyamadan önce ayarlanır (yanıp sönmeyi önler). Klasik script: <head> içinde, senkron yüklenir.
(function () {
  var t;
  try {
    t = localStorage.getItem('jo.theme');
  } catch (e) {
    /* yoksay */
  }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
})();
