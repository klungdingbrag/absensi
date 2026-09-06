/* TB Nusantara — Theme preference */
(function(){
  const KEY='tb_nusantara_theme';
  function getTheme(){
    const saved=localStorage.getItem(KEY);
    if(saved==='dark'||saved==='light')return saved;
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function applyTheme(theme){
    const dark=theme==='dark';
    document.body.classList.toggle('dark-mode',dark);
    const icon=document.getElementById('themeIcon');
    const label=document.getElementById('themeLabel');
    const button=document.getElementById('themeToggle');
    if(icon)icon.textContent=dark?'☀️':'🌙';
    if(label)label.textContent=dark?'Light':'Dark';
    if(button){button.setAttribute('aria-label',dark?'Aktifkan light mode':'Aktifkan dark mode');button.title=dark?'Light mode':'Dark mode';}
  }
  window.toggleDarkMode=function(){
    const next=document.body.classList.contains('dark-mode')?'light':'dark';
    localStorage.setItem(KEY,next);
    applyTheme(next);
  };
  function init(){applyTheme(getTheme());}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
