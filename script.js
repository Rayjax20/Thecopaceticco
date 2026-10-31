// script.js — general site behavior (nav, scroll, mobile book bar)

const navToggle = document.querySelector('.nav-toggle');
const mobileNavigation = document.querySelector('.nav nav');

if (navToggle && mobileNavigation) {
  const closeNavigation = () => {
    document.querySelector('.nav')?.classList.remove('menu-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = document.querySelector('.nav')?.classList.toggle('menu-open');
    navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });

  mobileNavigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNavigation);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) closeNavigation();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNavigation();
  });
}

// Smooth scroll for in-page anchor links
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Mobile book bar — hide when the booking section is on screen
const bookBar = document.querySelector('.mobile-book');
const bookingSection = document.getElementById('book');

if (bookBar && bookingSection) {
  const observer = new IntersectionObserver((entries) => {
    bookBar.style.display = entries[0].isIntersecting ? 'none' : 'block';
  });
  observer.observe(bookingSection);
}
