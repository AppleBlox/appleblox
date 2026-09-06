/**
 * WPFui/Bloxstrap bootstrapper theme parser for AppleBlox.
 * Converts fishstrap-compatible XML bootstrapper themes into web-renderable structures.
 * Aims for 1:1 visual parity with Bloxstrap's CustomDialog renderer.
 */

export interface ThemeFontRef {
    /** theme:// URL to the font file, e.g. "theme://assets/Font.ttf" */
    themeUrl: string;
    /** CSS font-family name, parsed from the "#Name" suffix */
    family: string;
}

export type ThemeLayoutMode = 'absolute' | 'grid' | 'flex' | 'canvas';

export interface ThemeElement {
    tag: string;
    name?: string;
    style: string;
    layoutMode: ThemeLayoutMode;
    gridTemplateRows?: string;
    gridTemplateColumns?: string;
    flexDirection?: 'column' | 'row';

    // Special bindings
    isIcon: boolean;
    isThemeImage: boolean;
    isProgressBar: boolean;
    isProgressRing: boolean;
    isLine: boolean;
    isCancelButton: boolean;
    isStatusText: boolean;

    // Content
    textContent?: string;
    source?: string;
    isAnimated?: boolean;

    // Progress
    progressFgColor?: string;
    progressBgColor?: string;
    isIndeterminate?: boolean;

    // Line geometry
    lineGeometry?: { x1: number; y1: number; x2: number; y2: number; strokeColor: string; strokeWidth: number };

    // Shape SVG
    shapeFill?: string;
    shapeStroke?: string;
    shapeStrokeWidth?: number;
    shapeRadiusX?: number;
    shapeRadiusY?: number;
    isEllipse?: boolean;

    children: ThemeElement[];
}

export interface ParsedTheme {
    width: number;
    height: number;
    mode: 'system' | 'dark' | 'light';
    background?: string;
    backgroundImage?: { url: string; stretch: string; tileMode?: string; viewport?: string; viewportUnits?: string };
    containerPadding?: string;
    cornerRadius?: number;
    fonts: ThemeFontRef[];
    elements: ThemeElement[];
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Return only element-node children of a node (nodeType === 1).
 * Uses childNodes for compatibility with xmldom (DOM Level 2) which lacks .children.
 */
function childElements(node: Node): Element[] {
    const kids: Element[] = [];
    for (let i = 0; i < node.childNodes.length; i++) {
        const n = node.childNodes[i];
        if (n.nodeType === 1) kids.push(n as Element);
    }
    return kids;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/** Convert XAML ARGB hex (#AARRGGBB) or #RRGGBB to a CSS color string. */
export function argbToCss(color: string): string {
    color = color.trim();
    if (!color.startsWith('#')) return color;
    if (color.length === 9) {
        const a = parseInt(color.slice(1, 3), 16) / 255;
        const r = parseInt(color.slice(3, 5), 16);
        const g = parseInt(color.slice(5, 7), 16);
        const b = parseInt(color.slice(7, 9), 16);
        if (a >= 0.999) return `#${color.slice(3)}`;
        return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    return color;
}

/**
 * Resolve a WPF color/brush value to a CSS color string.
 * Handles: #AARRGGBB, #RRGGBB, named WPF colors (lowercase for CSS).
 */
function resolveColor(value: string): string {
    if (!value) return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('#')) return argbToCss(trimmed);
    // Named WPF colors → CSS (CSS accepts them case-insensitively, but lowercase is idiomatic)
    return trimmed.toLowerCase();
}

// WPFui resource brush → CSS variable mapping
const WPF_RESOURCES: Record<string, string> = {
    TextFillColorPrimaryBrush: 'var(--wpf-text-primary)',
    TextFillColorSecondaryBrush: 'var(--wpf-text-secondary)',
    TextFillColorTertiaryBrush: 'var(--wpf-text-tertiary)',
    TextFillColorDisabledBrush: 'var(--wpf-text-disabled)',
    ApplicationBackgroundBrush: 'var(--wpf-app-bg)',
    ControlFillColorDefaultBrush: 'var(--wpf-control-fill)',
    ControlFillColorSecondaryBrush: 'var(--wpf-control-fill)',
};

/**
 * Resolve a WPF dynamic resource brush reference like "{TextFillColorPrimaryBrush}".
 * Returns a CSS variable string if recognised, or undefined.
 */
function resolveWpfBrush(value: string, fallback?: string): string {
    const key = value.trim();
    if (key in WPF_RESOURCES) return WPF_RESOURCES[key];
    return fallback ?? `var(--wpf-${key.replace(/Brush$/, '').toLowerCase()})`;
}

// ---------------------------------------------------------------------------
// Thickness / CornerRadius parsers
// ---------------------------------------------------------------------------

/**
 * Parse a XAML Margin/Thickness string ("L,T,R,B" | "H,V" | "N") → [top, right, bottom, left].
 * Also exported as parseMargin for backwards compatibility.
 */
export function parseMargin(margin: string): [number, number, number, number] {
    const parts = margin.split(',').map((s) => parseFloat(s.trim()) || 0);
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) return [parts[1], parts[0], parts[1], parts[0]]; // H,V
    if (parts.length === 4) return [parts[1], parts[2], parts[3], parts[0]]; // L,T,R,B → T,R,B,L
    return [0, 0, 0, 0];
}

/** Same as parseMargin — used for Padding/BorderThickness (XAML Thickness format). */
export function parseThickness(s: string): [number, number, number, number] {
    return parseMargin(s);
}

/**
 * Parse XAML CornerRadius ("10" | "tl,tr,br,bl") → CSS "Apx Bpx Cpx Dpx".
 * WPF CornerRadius order: TopLeft, TopRight, BottomRight, BottomLeft.
 * CSS border-radius order: TopLeft, TopRight, BottomRight, BottomLeft (same).
 */
function parseCornerRadius(s: string): string {
    const parts = s.split(',').map((v) => parseFloat(v.trim()) || 0);
    if (parts.length === 1) return `${parts[0]}px`;
    if (parts.length === 4) return `${parts[0]}px ${parts[1]}px ${parts[2]}px ${parts[3]}px`;
    return `${parseFloat(s)}px`;
}

// ---------------------------------------------------------------------------
// Grid length parser
// ---------------------------------------------------------------------------

/** Convert a WPF GridLength string ("Auto" | "*" | "2*" | "100") → CSS track size. */
function parseGridLength(s: string): string {
    const t = s.trim();
    if (t === 'Auto' || t === 'auto') return 'auto';
    if (t === '*') return '1fr';
    if (t.endsWith('*')) {
        const n = parseFloat(t) || 1;
        return `${n}fr`;
    }
    return `${parseFloat(t) || 0}px`;
}

// ---------------------------------------------------------------------------
// Transform parser
// ---------------------------------------------------------------------------

/**
 * Parse a transform property-element (e.g. <Image.RenderTransform>) into a CSS transform string.
 * Supports: RotateTransform, ScaleTransform, SkewTransform, TranslateTransform, TransformGroup.
 * Each transform's CenterX/CenterY is decomposed as: translate(cx,cy) [t] translate(-cx,-cy).
 */
function parseTransformEl(propEl: Element): string {
    const parts: string[] = [];

    function processTransform(el: Element): void {
        const tagName = el.tagName;
        if (tagName === 'TransformGroup') {
            for (const child of childElements(el)) processTransform(child);
            return;
        }
        const cx = parseFloat(el.getAttribute('CenterX') || '0') || 0;
        const cy = parseFloat(el.getAttribute('CenterY') || '0') || 0;
        const hasCentre = cx !== 0 || cy !== 0;

        if (tagName === 'RotateTransform') {
            const angle = parseFloat(el.getAttribute('Angle') || '0') || 0;
            if (hasCentre) {
                parts.push(`translate(${cx}px,${cy}px) rotate(${angle}deg) translate(${-cx}px,${-cy}px)`);
            } else {
                parts.push(`rotate(${angle}deg)`);
            }
        } else if (tagName === 'ScaleTransform') {
            const sx = parseFloat(el.getAttribute('ScaleX') || '1') || 1;
            const sy = parseFloat(el.getAttribute('ScaleY') || '1') || 1;
            if (hasCentre) {
                parts.push(`translate(${cx}px,${cy}px) scale(${sx},${sy}) translate(${-cx}px,${-cy}px)`);
            } else {
                parts.push(`scale(${sx},${sy})`);
            }
        } else if (tagName === 'SkewTransform') {
            const ax = parseFloat(el.getAttribute('AngleX') || '0') || 0;
            const ay = parseFloat(el.getAttribute('AngleY') || '0') || 0;
            if (hasCentre) {
                parts.push(`translate(${cx}px,${cy}px) skewX(${ax}deg) skewY(${ay}deg) translate(${-cx}px,${-cy}px)`);
            } else {
                parts.push(`skewX(${ax}deg) skewY(${ay}deg)`);
            }
        } else if (tagName === 'TranslateTransform') {
            const x = parseFloat(el.getAttribute('X') || '0') || 0;
            const y = parseFloat(el.getAttribute('Y') || '0') || 0;
            parts.push(`translate(${x}px,${y}px)`);
        }
    }

    for (const child of childElements(propEl)) processTransform(child);
    return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Effect parser
// ---------------------------------------------------------------------------

/**
 * Parse an effect property-element (e.g. <Rectangle.Effect>) into a CSS filter string.
 * Supports BlurEffect and DropShadowEffect.
 */
function parseEffectEl(propEl: Element): string {
    for (const child of childElements(propEl)) {
        const tag = child.tagName;
        if (tag === 'BlurEffect') {
            const radius = parseFloat(child.getAttribute('Radius') || '5') || 5;
            return `blur(${radius}px)`;
        }
        if (tag === 'DropShadowEffect') {
            const blurRadius = parseFloat(child.getAttribute('BlurRadius') || '5') || 5;
            const direction = parseFloat(child.getAttribute('Direction') || '315') || 315;
            const depth = parseFloat(child.getAttribute('ShadowDepth') || '5') || 5;
            const opacity = parseFloat(child.getAttribute('Opacity') || '1');
            const colorAttr = child.getAttribute('Color') || '#000000';
            const rad = (direction * Math.PI) / 180;
            const offsetX = depth * Math.cos(rad);
            const offsetY = -depth * Math.sin(rad);
            // Convert color + opacity to CSS rgba
            let shadowColor: string;
            const resolvedColor = resolveColor(colorAttr);
            if (resolvedColor.startsWith('rgba(')) {
                shadowColor = resolvedColor;
            } else if (resolvedColor.startsWith('#') && resolvedColor.length === 7) {
                const r = parseInt(resolvedColor.slice(1, 3), 16);
                const g = parseInt(resolvedColor.slice(3, 5), 16);
                const b = parseInt(resolvedColor.slice(5, 7), 16);
                shadowColor = `rgba(${r},${g},${b},${opacity.toFixed(3)})`;
            } else {
                shadowColor = resolvedColor;
            }
            return `drop-shadow(${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${blurRadius}px ${shadowColor})`;
        }
    }
    return '';
}

// ---------------------------------------------------------------------------
// Brush / background resolver
// ---------------------------------------------------------------------------

/** Convert a XAML LinearGradientBrush element to a CSS linear-gradient() string. */
function parseLinearGradient(el: Element): string {
    const startParts = (el.getAttribute('StartPoint') || '0,0').split(',').map(Number);
    const endParts = (el.getAttribute('EndPoint') || '0,1').split(',').map(Number);
    const dx = (endParts[0] ?? 0) - (startParts[0] ?? 0);
    const dy = (endParts[1] ?? 0) - (startParts[1] ?? 0);
    const deg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    const stops = childElements(el)
        .filter((c) => c.tagName === 'GradientStop')
        .map((c) => {
            const color = c.getAttribute('Color');
            const offset = Math.round(parseFloat(c.getAttribute('Offset') || '0') * 100);
            return color ? `${resolveColor(color)} ${offset}%` : null;
        })
        .filter(Boolean);
    return stops.length > 0 ? `linear-gradient(${deg}deg, ${stops.join(', ')})` : 'transparent';
}

/**
 * Resolve a brush attribute value to a CSS color/gradient string.
 * Handles: solid colors, named WPF colors, {ResourceKey} brushes.
 */
function resolveBrushAttr(value: string): string {
    if (!value) return '';
    if (value.startsWith('{') && value.endsWith('}')) {
        return resolveWpfBrush(value.slice(1, -1));
    }
    return resolveColor(value);
}

/**
 * Get a brush value from an element attribute or property-element syntax.
 * e.g. <Button.Background><SolidColorBrush Color="#FF..." /></Button.Background>
 * Returns CSS color/gradient string, or undefined.
 */
function getPropValue(el: Element, propName: string): string | undefined {
    const attr = el.getAttribute(propName);
    if (attr) return resolveBrushAttr(attr);

    const propTagName = `${el.tagName}.${propName}`;
    for (const child of childElements(el)) {
        if (child.tagName === propTagName) {
            for (const brush of childElements(child)) {
                if (brush.tagName === 'SolidColorBrush') {
                    const color = brush.getAttribute('Color');
                    return color ? resolveBrushAttr(color) : undefined;
                }
                if (brush.tagName === 'LinearGradientBrush') {
                    return parseLinearGradient(brush);
                }
            }
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// FontWeight mapping
// ---------------------------------------------------------------------------

function fontWeightToCss(value: string | null): string | undefined {
    if (!value) return undefined;
    const map: Record<string, string> = {
        Thin: '100',
        ExtraLight: '200',
        UltraLight: '200',
        Light: '300',
        Normal: '400',
        Regular: '400',
        Medium: '500',
        DemiBold: '600',
        SemiBold: '600',
        Bold: '700',
        ExtraBold: '800',
        UltraBold: '800',
        Black: '900',
        Heavy: '900',
        ExtraBlack: '950',
        UltraBlack: '950',
    };
    return map[value] ?? undefined;
}

// ---------------------------------------------------------------------------
// Style builder
// ---------------------------------------------------------------------------

interface BuildStyleOptions {
    parentLayout: ThemeLayoutMode;
    extraStyles?: string[];
}

/**
 * Build a CSS style string from a XAML element's positioning and visual attributes.
 * Layout strategy depends on how the parent lays out its children.
 */
function buildStyle(el: Element, opts: BuildStyleOptions): string {
    const { parentLayout, extraStyles = [] } = opts;
    const styles: string[] = [];

    const width = el.getAttribute('Width');
    const height = el.getAttribute('Height');
    const margin = el.getAttribute('Margin');
    const hAlign = el.getAttribute('HorizontalAlignment') || 'Left';
    const vAlign = el.getAttribute('VerticalAlignment') || 'Top';
    const bg = getPropValue(el, 'Background') || getPropValue(el, 'Fill');
    const fg = getPropValue(el, 'Foreground');
    const fontSize = el.getAttribute('FontSize');
    const opacity = el.getAttribute('Opacity');
    const cornerRadius = el.getAttribute('CornerRadius');
    const fontWeight = el.getAttribute('FontWeight');
    const fontStyle = el.getAttribute('FontStyle');
    const textAlign = el.getAttribute('TextAlignment');
    const textWrapping = el.getAttribute('TextWrapping');
    const textDecorations = el.getAttribute('TextDecorations');
    const lineHeight = el.getAttribute('LineHeight');
    const visibility = el.getAttribute('Visibility');
    const stretch = el.getAttribute('Stretch');
    const isEnabled = el.getAttribute('IsEnabled');
    const zIndex = el.getAttribute('Panel.ZIndex');
    const renderTransformOrigin = el.getAttribute('RenderTransformOrigin');
    const borderBrush = getPropValue(el, 'BorderBrush');
    const borderThickness = el.getAttribute('BorderThickness');
    const padding = el.getAttribute('Padding');

    if (visibility === 'Collapsed' || visibility === 'Hidden') styles.push('display: none');
    if (isEnabled === 'False') styles.push('pointer-events: none', 'opacity: 0.4');
    if (zIndex) {
        const z = Math.min(1000, Math.max(0, parseInt(zIndex) || 0));
        styles.push(`z-index: ${z}`);
    }

    if (width && width !== 'Auto') styles.push(`width: ${parseFloat(width)}px`);
    if (height && height !== 'Auto') styles.push(`height: ${parseFloat(height)}px`);
    if (bg) styles.push(`background: ${bg}`);
    if (fg) styles.push(`color: ${fg}`);
    if (fontSize) styles.push(`font-size: ${parseFloat(fontSize)}px`);
    if (opacity && isEnabled !== 'False') styles.push(`opacity: ${opacity}`);

    if (cornerRadius) {
        styles.push(`border-radius: ${parseCornerRadius(cornerRadius)}`);
        styles.push('overflow: hidden');
    }

    const fw = fontWeightToCss(fontWeight);
    if (fw) styles.push(`font-weight: ${fw}`);

    if (fontStyle === 'Italic') styles.push('font-style: italic');
    else if (fontStyle === 'Oblique') styles.push('font-style: oblique');

    if (textDecorations === 'Underline') styles.push('text-decoration: underline');
    else if (textDecorations === 'Strikethrough') styles.push('text-decoration: line-through');
    else if (textDecorations === 'OverLine') styles.push('text-decoration: overline');
    else if (textDecorations === 'Baseline') styles.push('text-decoration: underline');

    if (textWrapping === 'NoWrap') styles.push('white-space: nowrap');
    else if (textWrapping === 'Wrap') styles.push('white-space: pre-wrap');
    else if (textWrapping === 'WrapWithOverflow') styles.push('white-space: normal');

    if (lineHeight && lineHeight !== 'NaN') styles.push(`line-height: ${parseFloat(lineHeight)}px`);
    if (textAlign) styles.push(`text-align: ${textAlign.toLowerCase()}`);

    if (borderBrush && borderThickness) {
        const [bt, br, bb, bl] = parseThickness(borderThickness);
        styles.push(`border: ${bt}px ${br}px ${bb}px ${bl}px solid ${borderBrush}`);
    } else if (borderBrush) {
        styles.push(`border: 1px solid ${borderBrush}`);
    } else if (borderThickness) {
        const [bt, br, bb, bl] = parseThickness(borderThickness);
        styles.push(`border-width: ${bt}px ${br}px ${bb}px ${bl}px`);
    }

    if (padding) {
        const [pt, pr, pb, pl] = parseThickness(padding);
        styles.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);
    }

    // Stretch / object-fit mapping (for images)
    if (stretch === 'Fill') {
        styles.push('object-fit: fill');
        if (!width || width === 'Auto') styles.push('width: 100%');
        if (!height || height === 'Auto') styles.push('height: 100%');
    } else if (stretch === 'Uniform') {
        styles.push('object-fit: contain');
    } else if (stretch === 'UniformToFill') {
        styles.push('object-fit: cover');
    }

    // RenderTransformOrigin → CSS transform-origin
    if (renderTransformOrigin) {
        const [ox, oy] = renderTransformOrigin.split(',').map((v) => parseFloat(v.trim()) || 0);
        styles.push(`transform-origin: ${ox * 100}% ${oy * 100}%`);
    }

    // Collect transform parts from alignment centering + RenderTransform/LayoutTransform
    const transformParts: string[] = [];

    // Positioning based on parent layout mode
    if (parentLayout === 'canvas') {
        styles.push('position: absolute');
        const cl = el.getAttribute('Canvas.Left');
        const ct = el.getAttribute('Canvas.Top');
        const cr = el.getAttribute('Canvas.Right');
        const cb = el.getAttribute('Canvas.Bottom');
        if (cl !== null && cl !== '') styles.push(`left: ${parseFloat(cl)}px`);
        if (ct !== null && ct !== '') styles.push(`top: ${parseFloat(ct)}px`);
        if (cr !== null && cr !== '') styles.push(`right: ${parseFloat(cr)}px`);
        if (cb !== null && cb !== '') styles.push(`bottom: ${parseFloat(cb)}px`);
    } else if (parentLayout === 'grid') {
        // Grid cells use grid-row/column placement
        const gridRow = parseInt(el.getAttribute('Grid.Row') || '0') || 0;
        const gridRowSpan = parseInt(el.getAttribute('Grid.RowSpan') || '1') || 1;
        const gridCol = parseInt(el.getAttribute('Grid.Column') || '0') || 0;
        const gridColSpan = parseInt(el.getAttribute('Grid.ColumnSpan') || '1') || 1;
        styles.push(`grid-row: ${gridRow + 1} / span ${gridRowSpan}`);
        styles.push(`grid-column: ${gridCol + 1} / span ${gridColSpan}`);

        // Alignment within grid cell
        const jsMap: Record<string, string> = { Left: 'start', Center: 'center', Right: 'end', Stretch: 'stretch' };
        const asMap: Record<string, string> = { Top: 'start', Center: 'center', Bottom: 'end', Stretch: 'stretch' };
        if (hAlign in jsMap) styles.push(`justify-self: ${jsMap[hAlign]}`);
        if (vAlign in asMap) styles.push(`align-self: ${asMap[vAlign]}`);

        if (margin) {
            const [mt, mr, mb, ml] = parseMargin(margin);
            styles.push(`margin: ${mt}px ${mr}px ${mb}px ${ml}px`);
        }
    } else if (parentLayout === 'flex') {
        // Flex children: align-self
        const asMap: Record<string, string> = { Top: 'flex-start', Center: 'center', Bottom: 'flex-end', Stretch: 'stretch' };
        if (vAlign in asMap) styles.push(`align-self: ${asMap[vAlign]}`);
        if (margin) {
            const [mt, mr, mb, ml] = parseMargin(margin);
            styles.push(`margin: ${mt}px ${mr}px ${mb}px ${ml}px`);
        }
    } else {
        // absolute layout (default)
        styles.push('position: absolute');

        if (margin) {
            const [top, right, bottom, left] = parseMargin(margin);

            if (hAlign === 'Stretch') {
                if (!width || width === 'Auto') {
                    styles.push(`left: ${left}px`, `right: ${right}px`);
                } else {
                    if (left !== 0) styles.push(`left: ${left}px`);
                }
            } else if (hAlign === 'Center') {
                styles.push('left: 50%');
                transformParts.push('translateX(-50%)');
            } else if (hAlign === 'Right') {
                styles.push(`right: ${right}px`);
            } else {
                // Left (default)
                if (left !== 0) styles.push(`left: ${left}px`);
            }

            if (vAlign === 'Stretch') {
                if (!height || height === 'Auto') {
                    styles.push(`top: ${top}px`, `bottom: ${bottom}px`);
                } else {
                    styles.push(`top: ${top}px`);
                }
            } else if (vAlign === 'Center') {
                styles.push('top: 50%');
                transformParts.push('translateY(-50%)');
            } else if (vAlign === 'Bottom') {
                styles.push(`bottom: ${Math.max(0, bottom)}px`);
            } else {
                // Top (default)
                styles.push(`top: ${top}px`);
            }
        } else {
            // No margin
            if (stretch === 'Fill' || stretch === 'Uniform' || stretch === 'UniformToFill') {
                styles.push('top: 0', 'left: 0');
            } else {
                if (hAlign === 'Stretch') {
                    if (!width || width === 'Auto') styles.push('left: 0', 'right: 0');
                } else if (hAlign === 'Center') {
                    styles.push('left: 50%');
                    transformParts.push('translateX(-50%)');
                } else if (hAlign === 'Right') {
                    styles.push('right: 0');
                }
                // Left: no positioning needed (absolute default)

                if (vAlign === 'Stretch') {
                    if (!height || height === 'Auto') styles.push('top: 0', 'bottom: 0');
                } else if (vAlign === 'Center') {
                    styles.push('top: 50%');
                    transformParts.push('translateY(-50%)');
                } else if (vAlign === 'Bottom') {
                    styles.push('bottom: 0');
                }
                // Top: no positioning needed
            }
        }
    }

    // RenderTransform / LayoutTransform property elements → CSS transform
    const elChildren = childElements(el);
    const transformPropEl =
        elChildren.find((c) => c.tagName === `${el.tagName}.RenderTransform`) ||
        elChildren.find((c) => c.tagName === `${el.tagName}.LayoutTransform`);
    if (transformPropEl) {
        const xfm = parseTransformEl(transformPropEl);
        if (xfm) transformParts.push(xfm);
    }

    if (transformParts.length > 0) styles.push(`transform: ${transformParts.join(' ')}`);

    // Effect property element → CSS filter
    const effectPropEl = elChildren.find((c) => c.tagName === `${el.tagName}.Effect`);
    if (effectPropEl) {
        const filter = parseEffectEl(effectPropEl);
        if (filter) styles.push(`filter: ${filter}`);
    }

    styles.push(...extraStyles);
    return styles.join('; ');
}

// ---------------------------------------------------------------------------
// Text resource resolution
// ---------------------------------------------------------------------------

function resolveTextResource(text: string): string {
    if (!text.startsWith('{') || !text.endsWith('}')) return text;
    const key = text.slice(1, -1);
    if (key === 'Version') return 'AppleBlox';
    if (key === 'Common.Cancel') return 'Cancel';
    return '';
}

// ---------------------------------------------------------------------------
// Element parser
// ---------------------------------------------------------------------------

function parseElement(el: Element, fontRefs: ThemeFontRef[], parentLayout: ThemeLayoutMode = 'absolute'): ThemeElement {
    const tag = el.tagName;
    const name = el.getAttribute('Name') || el.getAttribute('x:Name') || undefined;
    const sourceAttr = el.getAttribute('Source');

    const isIcon = sourceAttr === '{Icon}';
    const isThemeImage = !isIcon && tag === 'Image' && !!sourceAttr?.startsWith('theme://');
    const isProgressBar = tag === 'ProgressBar';
    const isProgressRing = tag === 'ProgressRing';
    const isLine = tag === 'Line';
    const isCancelButton = name === 'CancelButton';
    const isStatusText = name === 'StatusText';
    const isAnimated = el.getAttribute('IsAnimated') === 'True';
    // Named primary controls always use real (determinate) progress regardless of IsIndeterminate attr.
    const isPrimaryControl =
        (isProgressBar && name === 'PrimaryProgressBar') ||
        (isProgressRing && name === 'PrimaryProgressRing');
    const isIndeterminateResolved: boolean | undefined = isPrimaryControl
        ? false
        : el.getAttribute('IsIndeterminate') === 'True'
          ? true
          : el.getAttribute('IsIndeterminate') === 'False'
            ? false
            : undefined;

    // FontFamily handling
    const fontFamilyAttr = el.getAttribute('FontFamily');
    const extraStyles: string[] = [];
    if (fontFamilyAttr) {
        if (fontFamilyAttr.startsWith('theme://')) {
            const hashIdx = fontFamilyAttr.indexOf('#');
            const themeUrl = hashIdx !== -1 ? fontFamilyAttr.slice(0, hashIdx) : fontFamilyAttr;
            const family =
                hashIdx !== -1
                    ? fontFamilyAttr.slice(hashIdx + 1)
                    : themeUrl.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'ThemeFont';
            extraStyles.push(`font-family: '${family}'`);
            if (!fontRefs.some((f) => f.themeUrl === themeUrl)) {
                fontRefs.push({ themeUrl, family });
            }
        } else {
            extraStyles.push(`font-family: ${fontFamilyAttr}`);
        }
    }

    // TextBlock default: text-align center (matches Bloxstrap source)
    if (tag === 'TextBlock' || tag === 'MarkdownTextBlock' || tag === 'Label') {
        const ta = el.getAttribute('TextAlignment');
        if (!ta) extraStyles.push('text-align: center');
    }

    // Determine this element's layout mode for its children
    let layoutMode: ThemeLayoutMode = 'absolute';
    let gridTemplateRows: string | undefined;
    let gridTemplateColumns: string | undefined;
    let flexDirection: 'column' | 'row' | undefined;

    const elChildren = childElements(el);

    if (tag === 'Grid') {
        const rowDefEl = elChildren.find((c) => c.tagName === 'Grid.RowDefinitions');
        const colDefEl = elChildren.find((c) => c.tagName === 'Grid.ColumnDefinitions');
        if (rowDefEl || colDefEl) {
            layoutMode = 'grid';
            extraStyles.push('display: grid');
            if (rowDefEl) {
                const rows = childElements(rowDefEl)
                    .filter((c) => c.tagName === 'RowDefinition')
                    .map((c) => parseGridLength(c.getAttribute('Height') || '*'));
                gridTemplateRows = rows.join(' ');
                extraStyles.push(`grid-template-rows: ${gridTemplateRows}`);
            }
            if (colDefEl) {
                const cols = childElements(colDefEl)
                    .filter((c) => c.tagName === 'ColumnDefinition')
                    .map((c) => parseGridLength(c.getAttribute('Width') || '*'));
                gridTemplateColumns = cols.join(' ');
                extraStyles.push(`grid-template-columns: ${gridTemplateColumns}`);
            }
        }
    } else if (tag === 'StackPanel') {
        layoutMode = 'flex';
        const orientation = el.getAttribute('Orientation') || 'Vertical';
        flexDirection = orientation === 'Horizontal' ? 'row' : 'column';
        extraStyles.push('display: flex', `flex-direction: ${flexDirection}`);
    } else if (tag === 'Canvas') {
        layoutMode = 'canvas';
    }

    // Container size defaults (fill parent when no explicit size)
    if (['Grid', 'StackPanel', 'Canvas', 'DockPanel', 'WrapPanel', 'Border'].includes(tag)) {
        const hasWidth = !!el.getAttribute('Width') && el.getAttribute('Width') !== 'Auto';
        const hasHeight = !!el.getAttribute('Height') && el.getAttribute('Height') !== 'Auto';
        const hAlign = el.getAttribute('HorizontalAlignment') || '';
        const vAlign = el.getAttribute('VerticalAlignment') || '';
        const hasMargin = !!el.getAttribute('Margin');
        if (!hasWidth && hAlign !== 'Left' && hAlign !== 'Right' && hAlign !== 'Center') {
            extraStyles.push('width: 100%');
            if (!hasMargin && hAlign !== 'Right' && parentLayout === 'absolute') extraStyles.push('left: 0');
        }
        if (!hasHeight && vAlign !== 'Top' && vAlign !== 'Bottom' && vAlign !== 'Center') {
            extraStyles.push('height: 100%');
            if (!hasMargin && vAlign !== 'Bottom' && parentLayout === 'absolute') extraStyles.push('top: 0');
        }
    }

    // Rectangle/Ellipse defaults (Stretch=Fill in WPF)
    if (tag === 'Rectangle' || tag === 'Ellipse') {
        const hasMargin = !!el.getAttribute('Margin');
        const hasHAlign = !!el.getAttribute('HorizontalAlignment');
        const hasVAlign = !!el.getAttribute('VerticalAlignment');
        if (!el.getAttribute('Width') || el.getAttribute('Width') === 'Auto') {
            extraStyles.push('width: 100%');
        }
        if (!el.getAttribute('Height') || el.getAttribute('Height') === 'Auto') {
            extraStyles.push('height: 100%');
        }
        if (!hasMargin && !hasHAlign && !hasVAlign && parentLayout === 'absolute') {
            extraStyles.push('top: 0', 'left: 0');
        }
    }

    const style = buildStyle(el, {
        parentLayout,
        extraStyles: [
            ...(isProgressBar ? ['overflow: hidden', 'border-radius: 4px'] : []),
            ...extraStyles,
        ],
    });

    // Text content
    const rawText = el.getAttribute('Text') || el.getAttribute('Content') || el.textContent?.trim() || undefined;
    let textContent: string | undefined = rawText && rawText.trim().length > 0 ? rawText.trim() : undefined;
    if (textContent) textContent = resolveTextResource(textContent);
    if (textContent === '') textContent = undefined;

    // Progress colors
    let progressFgColor: string | undefined;
    let progressBgColor: string | undefined;
    if (isProgressBar || isProgressRing) {
        const fgVal = getPropValue(el, 'Foreground');
        const bgVal = getPropValue(el, 'Background');
        if (fgVal) progressFgColor = fgVal;
        if (bgVal) progressBgColor = bgVal;
    }

    // Line geometry
    let lineGeometry: ThemeElement['lineGeometry'];
    if (isLine) {
        const strokeAttr = el.getAttribute('Stroke') || getPropValue(el, 'Stroke') || '#000000';
        lineGeometry = {
            x1: parseFloat(el.getAttribute('X1') || '0') || 0,
            y1: parseFloat(el.getAttribute('Y1') || '0') || 0,
            x2: parseFloat(el.getAttribute('X2') || '0') || 0,
            y2: parseFloat(el.getAttribute('Y2') || '0') || 0,
            strokeColor: resolveBrushAttr(strokeAttr),
            strokeWidth: parseFloat(el.getAttribute('StrokeThickness') || '1') || 1,
        };
    }

    // Shape fill/stroke for SVG rendering
    let shapeFill: string | undefined;
    let shapeStroke: string | undefined;
    let shapeStrokeWidth: number | undefined;
    let shapeRadiusX: number | undefined;
    let shapeRadiusY: number | undefined;
    const isEllipse = tag === 'Ellipse';
    if (tag === 'Rectangle' || tag === 'Ellipse') {
        const fillVal = getPropValue(el, 'Fill');
        const strokeVal = el.getAttribute('Stroke') || getPropValue(el, 'Stroke');
        if (fillVal) shapeFill = fillVal;
        if (strokeVal) {
            shapeStroke = resolveBrushAttr(strokeVal);
            shapeStrokeWidth = parseFloat(el.getAttribute('StrokeThickness') || '1') || 1;
        }
        if (tag === 'Rectangle') {
            const rx = el.getAttribute('RadiusX');
            const ry = el.getAttribute('RadiusY');
            if (rx) shapeRadiusX = parseFloat(rx) || 0;
            if (ry) shapeRadiusY = parseFloat(ry) || 0;
        }
    }

    // Collect direct children (skip property-element syntax tags and TitleBar)
    const directChildren = elChildren.filter((c) => !c.tagName.includes('.') && c.tagName !== 'TitleBar' && c.tagName !== 'Grid.RowDefinitions' && c.tagName !== 'Grid.ColumnDefinitions');

    // Extract children from *.Content and *.Child property elements
    const contentPropChildren: Element[] = [];
    elChildren
        .filter((c) => c.tagName === `${tag}.Content` || c.tagName === `${tag}.Child`)
        .forEach((propEl) => childElements(propEl).forEach((c) => contentPropChildren.push(c)));

    const childLayoutMode = layoutMode; // children are laid out by THIS element's mode
    const children = [...directChildren, ...contentPropChildren].map((c) => parseElement(c, fontRefs, childLayoutMode));

    return {
        tag,
        name,
        style,
        layoutMode,
        gridTemplateRows,
        gridTemplateColumns,
        flexDirection,
        source: isThemeImage ? (sourceAttr ?? undefined) : undefined,
        textContent: isIcon ? undefined : textContent,
        isIcon,
        isThemeImage,
        isProgressBar,
        isProgressRing,
        isLine,
        isCancelButton,
        isStatusText,
        isAnimated: isAnimated || undefined,
        isIndeterminate: isIndeterminateResolved,
        progressFgColor,
        progressBgColor,
        lineGeometry,
        shapeFill,
        shapeStroke,
        shapeStrokeWidth,
        shapeRadiusX,
        shapeRadiusY,
        isEllipse: isEllipse || undefined,
        children,
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a fishstrap/Bloxstrap-compatible bootstrapper XML theme.
 * Returns null if the XML is invalid or not a recognised bootstrapper theme.
 */
export function parseBootstrapperTheme(xml: string): ParsedTheme | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const rootEl = doc.documentElement;
        if (!rootEl || rootEl.tagName === 'parsererror' || rootEl.tagName.toLowerCase() === 'parsererror') return null;

        const root = rootEl.tagName === 'BloxstrapCustomBootstrapper' ? rootEl : null;
        if (!root) return null;

        const width = parseFloat(root.getAttribute('Width') || '500') || 500;
        const height = parseFloat(root.getAttribute('Height') || '320') || 320;

        const themeAttr = root.getAttribute('Theme') || 'Default';
        const mode: ParsedTheme['mode'] = themeAttr === 'Dark' ? 'dark' : themeAttr === 'Light' ? 'light' : 'system';

        const bgAttr = getPropValue(root, 'Background');
        const background = bgAttr ? bgAttr : undefined;

        // Check for ImageBrush root background
        let backgroundImage: ParsedTheme['backgroundImage'];
        const bgPropTag = 'BloxstrapCustomBootstrapper.Background';
        for (const child of childElements(root)) {
            if (child.tagName === bgPropTag) {
                for (const brush of childElements(child)) {
                    if (brush.tagName === 'ImageBrush') {
                        const src = brush.getAttribute('ImageSource');
                        // Accept theme:// URLs and {Icon} binding
                        if (src && (src.startsWith('theme://') || src === '{Icon}')) {
                            backgroundImage = {
                                url: src,
                                stretch: brush.getAttribute('Stretch') || 'Fill',
                                tileMode: brush.getAttribute('TileMode') || 'None',
                                viewport: brush.getAttribute('Viewport') || undefined,
                                viewportUnits: brush.getAttribute('ViewportUnits') || undefined,
                            };
                        }
                    }
                }
            }
        }

        const marginAttr = root.getAttribute('Margin');
        let containerPadding: string | undefined;
        if (marginAttr) {
            const [top, right, bottom, left] = parseMargin(marginAttr);
            containerPadding = `${top}px ${right}px ${bottom}px ${left}px`;
        }

        const cornerRadiusAttr = root.getAttribute('CornerRadius');
        const cornerRadius = cornerRadiusAttr ? parseFloat(cornerRadiusAttr) || undefined : undefined;

        const fontRefs: ThemeFontRef[] = [];
        const elements = childElements(root)
            .filter((el) => !el.tagName.includes('.') && el.tagName !== 'TitleBar')
            .map((el) => parseElement(el, fontRefs, 'absolute'));

        return { width, height, mode, background, backgroundImage, containerPadding, cornerRadius, fonts: fontRefs, elements };
    } catch {
        return null;
    }
}
