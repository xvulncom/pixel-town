// 对话框：和镇上的人搭话时弹出来，左边说话人的立绘，右边名字和台词。点一下框或过一会儿自己收起。
// 立绘图集 portraits.png / portraits-frames.json 由 tools/gen-map.ts 生成；取哪一格、缺图怎么办见 core/portrait.ts，
// 摆在哪儿见 core/chatLayout.ts（横竖屏同一规则）。画布重搭时跟着重建，不用自己处理转屏。

import {
    Color, Graphics, ImageAsset, JsonAsset, Label, Node, Rect as CcRect, resources, Sprite, SpriteFrame, Texture2D, UITransform,
} from 'cc';
import { chatBoxLayout, ChatBoxLayout } from '../core/chatLayout';
import { portraitCell, PortraitSheet } from '../core/portrait';
import { Rect } from '../core/screen';
import { ACCENT, drawBox, GOLD, INK, label, PAPER, uiNode } from './ui';

/** 多久没点自己收起（毫秒） */
const AUTO_HIDE_MS = 9000;
/** 立绘原图边长，图集还没读到时按它排版 */
const PORTRAIT_PX = 48;
const BACKDROP = new Color(236, 214, 170, 255);
const FRAME = new Color(120, 82, 52, 255);

export interface ChatBox {
    /** id 是说话人，alt 是备选（工人的 look）；gained 好感加了多少，0 不显示 */
    show(id: string, name: string, text: string, gained?: number, alt?: string): void;
    hide(): void;
}

/** 屏幕坐标（左上角原点）的矩形换成父节点（画布中心原点）里的位置，再摆到 box 节点里的相对位置。 */
function put(n: Node, r: Rect, box: Rect): void {
    n.getComponent(UITransform)!.setContentSize(r.w, r.h);
    n.setPosition(r.x + r.w / 2 - (box.x + box.w / 2), box.y + box.h / 2 - (r.y + r.h / 2), 0);
}

export function buildChatBox(parent: Node, W: number, H: number, top: number, bottomPad: number, avoid: Rect | null): ChatBox {
    const L: ChatBoxLayout = chatBoxLayout(W, H, top, bottomPad, avoid, PORTRAIT_PX);
    const { box } = L;
    const root = uiNode('ChatBox', parent, box.w, box.h);
    root.setPosition(box.x + box.w / 2 - W / 2, H / 2 - (box.y + box.h / 2), 0);
    drawBox(root.addComponent(Graphics), box.w, box.h, PAPER, 16, INK);
    root.active = false;

    // 立绘：暖色底 + 木框，图片按整数倍放大不糊
    const frame = uiNode('PortraitFrame', root);
    put(frame, { x: L.portrait.x - 4, y: L.portrait.y - 4, w: L.portrait.w + 8, h: L.portrait.h + 8 }, box);
    drawBox(frame.addComponent(Graphics), L.portrait.w + 8, L.portrait.h + 8, BACKDROP, 8, FRAME);
    const pic = uiNode('Portrait', root);
    put(pic, L.portrait, box);
    const sprite = pic.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const nameNode = uiNode('NamePlate', root);
    put(nameNode, L.name, box);
    const plate = nameNode.addComponent(Graphics);
    const nameLabel = label(nameNode, '', 28, GOLD, L.name.w, L.name.h, 'Name');
    nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    const textLabel = label(root, '', 28, INK, L.text.w, L.text.h, 'Text');
    put(textLabel.node, L.text, box);
    textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    textLabel.verticalAlign = Label.VerticalAlign.TOP;
    textLabel.lineHeight = 38;
    textLabel.enableWrapText = true;

    let sheet: PortraitSheet | null = null;
    let tex: Texture2D | null = null;
    let pending: [string, string | undefined] | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const setPortrait = (id: string, alt?: string) => {
        if (!sheet || !tex) {
            pending = [id, alt];
            sprite.spriteFrame = null;
            return;
        }
        const cell = portraitCell(sheet, id, alt);
        const sf = new SpriteFrame();
        sf.texture = tex;
        sf.rect = new CcRect(cell.x, cell.y, cell.size, cell.size);
        sprite.spriteFrame = sf;
    };
    resources.load('maps/portraits-frames', JsonAsset, (e1, info) => {
        resources.load('maps/portraits', ImageAsset, (e2, img) => {
            if (e1 || e2 || !info || !img || !root.isValid) {
                console.error('立绘加载失败', e1 ?? e2);
                return;
            }
            sheet = info.json as PortraitSheet;
            tex = new Texture2D();
            tex.image = img;
            tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
            if (pending) setPortrait(...pending);
            pending = null;
        });
    });

    const hide = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (root.isValid) root.active = false;
    };
    root.on(Node.EventType.TOUCH_END, hide);
    // 点在框上不拖地图
    root.on(Node.EventType.TOUCH_START, () => undefined);

    return {
        show(id, name, text, gained = 0, alt) {
            if (!root.isValid) return;
            setPortrait(id, alt);
            nameLabel.string = gained > 0 ? `${name}  好感 +${gained}` : name;
            // 名字底下一条强调色短条
            plate.clear();
            plate.fillColor = ACCENT;
            plate.rect(-L.name.w / 2, -L.name.h / 2, Math.min(L.name.w, 120), 3);
            plate.fill();
            textLabel.string = text;
            root.active = true;
            root.setSiblingIndex(parent.children.length - 1);
            if (timer) clearTimeout(timer);
            timer = setTimeout(hide, AUTO_HIDE_MS);
        },
        hide,
    };
}
