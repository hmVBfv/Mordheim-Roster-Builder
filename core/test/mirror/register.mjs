/* node --import core/test/mirror/register.mjs test/<file>.mjs
   Installs the mirror's module hooks before the legacy test loads. */
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
