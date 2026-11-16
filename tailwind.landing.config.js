import base from './tailwind.config.js';

/**
 * Tailwind config for the public landing page (index.html). It shares the app's
 * theme but scans only the landing page, so its stylesheet stays tiny.
 * @type {import('tailwindcss').Config}
 */
export default {
  ...base,
  // Same "class" dark mode as the app: index.html adds the `dark` class from the system
  // setting before first paint, so dark: utilities and the page background always agree.
  content: ['./index.html', './src/landing/**/*.ts'],
};
