import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';

const config = [
  // Build JavaScript
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        outDir: 'dist',
      }),
    ],
    external: ['bullmq', 'ioredis', 'events', 'zod'],
  },
  // Build TypeScript declarations
  {
    input: 'dist/types/index.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];

export default config;