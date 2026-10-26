/**
 * Marks each [data-reveal] element with data-revealed the first time it enters the viewport, then stops watching it.
 * Components style their own initial and revealed states inside @media (scripting: enabled), so a page without JavaScript shows everything.
 */
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.setAttribute('data-revealed', '');
      observer.unobserve(entry.target);
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
);

for (const element of document.querySelectorAll('[data-reveal]')) observer.observe(element);
