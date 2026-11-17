// Mobile menu
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
}
// Dropdowns open on click too (touch devices / keyboard)
document.querySelectorAll('.nav li > button').forEach((btn) => {
  btn.addEventListener('click', () => btn.parentElement.classList.toggle('open'));
});

// Image sliders (building hire)
document.querySelectorAll('.slider').forEach((slider) => {
  const imgs = [...slider.querySelectorAll('img')];
  if (imgs.length < 2) { imgs[0]?.classList.add('on'); return; }
  let i = 0;
  const show = (n) => { imgs[i].classList.remove('on'); i = (n + imgs.length) % imgs.length; imgs[i].classList.add('on'); };
  imgs[0].classList.add('on');
  let timer = setInterval(() => show(i + 1), 4000);
  const restart = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 4000); };
  slider.querySelector('.prev')?.addEventListener('click', () => { show(i - 1); restart(); });
  slider.querySelector('.next')?.addEventListener('click', () => { show(i + 1); restart(); });
});

// Forms: post to /api/<form> (a Cloudflare Pages Function, to be added with the backend).
document.querySelectorAll('form[data-form]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('.form-status');
    const say = (msg) => { if (status) status.textContent = msg; };
    say('Sending…');
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      say('Thanks for submitting!');
    } catch {
      say('Sorry, the form could not be sent. Please email us instead.');
    }
  });
});
