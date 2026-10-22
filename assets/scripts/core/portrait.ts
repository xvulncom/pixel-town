// 对话立绘怎么取：图集 portraits.png + portraits-frames.json（tools/art/portraits.ts 生成），按人物 id 找格子。
// 找不到就依次试备选 id（比如工人的 look），都没有用 fallback 那张（灰色剪影），保证说话框里总有张脸。

export interface PortraitSheet {
    /** 每张边长（美术像素） */
    size: number;
    /** 图集每行几张 */
    cols: number;
    ids: string[];
    /** 缺立绘时用的 id，必须在 ids 里 */
    fallback: string;
}

export interface PortraitCell {
    id: string;
    /** 图集里的像素位置（左上角原点） */
    x: number;
    y: number;
    size: number;
    /** true 表示用的是 fallback */
    missing: boolean;
}

export function portraitCell(sheet: PortraitSheet, ...candidates: (string | undefined)[]): PortraitCell {
    let id = candidates.find((c): c is string => !!c && sheet.ids.includes(c));
    const missing = !id;
    if (!id) id = sheet.ids.includes(sheet.fallback) ? sheet.fallback : sheet.ids[0];
    const i = Math.max(0, sheet.ids.indexOf(id));
    return { id, x: (i % sheet.cols) * sheet.size, y: Math.floor(i / sheet.cols) * sheet.size, size: sheet.size, missing };
}
