// Bundles a few React Bits components (https://github.com/DavidHDev/react-bits)
// so the plain-JS hub can drop them into the page:
//   <span data-bit="BlurText" data-props='{"text":"Hello"}'></span>
// then Bits.mountAll(rootElement).
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import Aurora from '../../react-bits/src/content/Backgrounds/Aurora/Aurora.jsx';
import BlurText from '../../react-bits/src/content/TextAnimations/BlurText/BlurText.jsx';
import ShinyText from '../../react-bits/src/content/TextAnimations/ShinyText/ShinyText.jsx';
import GradientText from '../../react-bits/src/content/TextAnimations/GradientText/GradientText.jsx';
import TiltedCard from '../../react-bits/src/content/Components/TiltedCard/TiltedCard.jsx';
import SpotlightCard from '../../react-bits/src/content/Components/SpotlightCard/SpotlightCard.jsx';

// Magic UI (https://github.com/magicuidesign/magicui)
import { BorderBeam } from '../../magicui/apps/www/registry/magicui/border-beam.tsx';
import { Marquee } from '../../magicui/apps/www/registry/magicui/marquee.tsx';
import { ShineBorder } from '../../magicui/apps/www/registry/magicui/shine-border.tsx';
// GSAP (https://github.com/greensock/GSAP) for scroll animation
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;

const components = { Aurora, BlurText, ShinyText, GradientText, TiltedCard, SpotlightCard, BorderBeam, Marquee, ShineBorder };
const live = [];

function mount(el) {
  const C = components[el.dataset.bit];
  if (!C || el.dataset.bitOn) return;
  let props = {};
  try {
    props = JSON.parse(el.dataset.props || '{}');
  } catch {}
  // Anything already inside the placeholder becomes the component's content.
  const html = el.innerHTML.trim();
  const children = html ? createElement('div', { className: 'bit-html', dangerouslySetInnerHTML: { __html: html } }) : props.children;
  el.innerHTML = '';
  el.dataset.bitOn = '1';
  const root = createRoot(el);
  // Render straight away so the hub's own count-up / bar animations can find the content.
  flushSync(() => root.render(createElement(C, props, children)));
  live.push({ el, root });
}

function mountAll(scope = document) {
  // Drop components whose placeholder has left the page.
  for (let i = live.length - 1; i >= 0; i--) {
    if (!live[i].el.isConnected) {
      live[i].root.unmount();
      live.splice(i, 1);
    }
  }
  scope.querySelectorAll('[data-bit]').forEach(mount);
}

window.Bits = { mountAll, components: Object.keys(components) };
