import { z } from 'zod';

// Pas de compilation des schémas par `new Function` : interdite par la CSP (spec technique §12).
z.config({ jitless: true });

export { z };
