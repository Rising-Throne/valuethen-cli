#!/usr/bin/env node
/** ValueThen CLI. The logic lives in src/cli.js so it can be tested without a network. */
import { run } from '../src/cli.js';

process.exitCode = await run(process.argv.slice(2));
