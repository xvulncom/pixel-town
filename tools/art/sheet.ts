// 图块集：16px 小块和多格大图（切块）都收进来，最后拼成一张图。

import { mulberry32 } from '../../assets/scripts/core/rng';
import { Canvas, COLS, EMPTY, Pen, TILE } from './canvas';

export class Sheet {
    readonly tiles: Canvas[] = [];
    private seed = 1000;

    /** 加一个 16px 图块，返回编号。 */
    add(paint: (p: Pen) => void): number {
        const c = new Canvas(TILE, TILE);
        paint(new Pen(c, mulberry32(this.seed++)));
        this.tiles.push(c);
        return this.tiles.length - 1;
    }

    /** 画一张 w×h 格的大图，切成小块，返回 [行][列] 编号；全透明的块记为 EMPTY。 */
    sprite(w: number, h: number, paint: (p: Pen) => void): number[][] {
        const big = new Canvas(w * TILE, h * TILE);
        paint(new Pen(big, mulberry32(this.seed++)));
        const grid: number[][] = [];
        for (let ty = 0; ty < h; ty++) {
            const row: number[] = [];
            for (let tx = 0; tx < w; tx++) {
                const c = new Canvas(TILE, TILE);
                let solid = false;
                for (let y = 0; y < TILE; y++) {
                    for (let x = 0; x < TILE; x++) {
                        const si = ((ty * TILE + y) * big.w + tx * TILE + x) * 4;
                        const di = (y * TILE + x) * 4;
                        for (let k = 0; k < 4; k++) c.px[di + k] = big.px[si + k];
                        if (big.px[si + 3] > 0) solid = true;
                    }
                }
                if (solid) {
                    this.tiles.push(c);
                    row.push(this.tiles.length - 1);
                } else {
                    row.push(EMPTY);
                }
            }
            grid.push(row);
        }
        return grid;
    }

    toCanvas(): Canvas {
        const rows = Math.ceil(this.tiles.length / COLS);
        const out = new Canvas(COLS * TILE, rows * TILE);
        this.tiles.forEach((t, i) => {
            const ox = (i % COLS) * TILE;
            const oy = Math.floor(i / COLS) * TILE;
            for (let y = 0; y < TILE; y++) {
                for (let x = 0; x < TILE; x++) {
                    const si = (y * TILE + x) * 4;
                    const di = ((oy + y) * out.w + ox + x) * 4;
                    for (let k = 0; k < 4; k++) out.px[di + k] = t.px[si + k];
                }
            }
        });
        return out;
    }
}

