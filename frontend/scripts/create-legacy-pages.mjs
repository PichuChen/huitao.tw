import { copyFile } from 'node:fs/promises';

const routes = [
  'guasha-hq',
  'guasha-blue',
  'guasha-orchid',
  'guasha-red-b',
  'medcoral',
];

await Promise.all(
  routes.map((route) =>
    copyFile(
      new URL(`../dist/${route}/index.html`, import.meta.url),
      new URL(`../dist/${route}.html`, import.meta.url),
    ),
  ),
);
