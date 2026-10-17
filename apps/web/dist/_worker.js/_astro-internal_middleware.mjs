globalThis.process ??= {}; globalThis.process.env ??= {};
import './chunks/astro-designed-error-pages_EtJiJSqB.mjs';
import './chunks/astro/server_KeCo5y3E.mjs';
import { s as sequence } from './chunks/render-context_KUZQIVEz.mjs';

const onRequest$1 = (context, next) => {
  if (context.isPrerendered) {
    context.locals.runtime ??= {
      env: process.env
    };
  }
  return next();
};

const onRequest = sequence(
	onRequest$1,
	
	
);

export { onRequest };
