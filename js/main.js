// Nav scroll state
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => revealObs.observe(el));

// Reserve form — POST to velaro-booking API
const RESERVATIONS_API = 'https://velaro-booking.vercel.app/api/reservations';
const form = document.getElementById('reserve-form');
if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btnEl = form.querySelector('.reserve__btn');
    const btn = btnEl.querySelector('span');
    const originalText = btn.textContent;

    btn.textContent = '送信中…';
    btnEl.disabled = true;

    const data = {
      checkin: form.checkin.value,
      checkout: form.checkout.value,
      guests: Number(form.guests.value),
      villa: form.villa.value,
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
    };

    try {
      const res = await fetch(RESERVATIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '送信に失敗しました');
      }
      btn.textContent = 'お問い合わせを受け付けました — 確認メールをお送りしました。';
    } catch (err) {
      btn.textContent = `送信失敗: ${err.message}`;
      btnEl.disabled = false;
      setTimeout(() => { btn.textContent = originalText; }, 4000);
    }
  });
}
