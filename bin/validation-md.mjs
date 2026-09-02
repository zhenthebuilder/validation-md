#!/usr/bin/env node

import { main } from "../lib/cli/main.mjs";

process.exitCode = main(process.argv.slice(2));
