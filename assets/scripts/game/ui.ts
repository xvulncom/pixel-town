// 代码搭界面用的小工具：节点、底板、文字、按钮。场景文件不手工维护，界面都在代码里搭。

import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

export const UI_LAYER = Layers.Enum.UI_2D;

export function uiNode(name: string, parent: Node, w = 0, h = 0): Node {
    const n = new Node(name);
    n.layer = UI_LAYER;
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    return n;
}

/** 圆角底板，画在节点自己的中心。 */
export function drawBox(g: Graphics, w: number, h: number, fill: Color, radius = 12, stroke?: Color): void {
    g.clear();
    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    if (stroke) {
        g.lineWidth = 3;
        g.strokeColor = stroke;
        g.roundRect(-w / 2, -h / 2, w, h, radius);
        g.stroke();
    }
}

export function label(parent: Node, text: string, size: number, color: Color, w = 0, h = 0, name = 'Label'): Label {
    const n = uiNode(name, parent, w, h);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = size + 6;
    l.color = color;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    l.verticalAlign = Label.VerticalAlign.CENTER;
    if (w > 0 && h > 0) l.overflow = Label.Overflow.SHRINK;
    return l;
}

export const INK = new Color(255, 248, 225, 255);
export const PAPER = new Color(58, 44, 32, 230);
export const ACCENT = new Color(196, 74, 52, 255);
export const MUTED = new Color(110, 98, 86, 255);
export const GOLD = new Color(255, 214, 102, 255);

export interface Button {
    node: Node;
    label: Label;
    /** 高亮（如当前选中的工具）。 */
    setActive(on: boolean): void;
    setEnabled(on: boolean): void;
}

export function button(parent: Node, text: string, w: number, h: number, onTap: () => void, name = text): Button {
    const node = uiNode(name, parent, w, h);
    const g = node.addComponent(Graphics);
    const l = label(node, text, 30, INK, w - 12, h - 8);
    let active = false;
    let enabled = true;
    const paint = () => drawBox(g, w, h, !enabled ? MUTED : active ? ACCENT : PAPER, 14, INK);
    paint();
    node.on(Node.EventType.TOUCH_END, () => {
        if (enabled) onTap();
    });
    return {
        node,
        label: l,
        setActive(on) {
            active = on;
            paint();
        },
        setEnabled(on) {
            enabled = on;
            paint();
        },
    };
}
