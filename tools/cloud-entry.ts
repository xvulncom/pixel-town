// 打包进云函数的入口：云端推进用的 core 和正式内容。npm run build:cloud 生成 core.js。
export { tickAll } from '../assets/scripts/core/cloudTick';
export { WORLD } from '../assets/scripts/data/world';
