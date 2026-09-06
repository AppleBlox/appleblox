/**
 * Unit tests for the WPFui/Bloxstrap bootstrapper theme parser.
 * Uses @xmldom/xmldom to polyfill DOMParser in the bun test environment.
 */

import { describe, expect, it } from 'bun:test';
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';

// Polyfill DOMParser before any test runs — must be module-level (not in beforeAll)
// because bun evaluates all test callbacks before running beforeAll hooks.
(globalThis as any).DOMParser = XmlDOMParser;

import { argbToCss, parseMargin, parseThickness, parseBootstrapperTheme } from './wpfui-theme';

// ---------------------------------------------------------------------------
// argbToCss
// ---------------------------------------------------------------------------
describe('argbToCss', () => {
    it('passes through plain #RRGGBB values unchanged', () => {
        expect(argbToCss('#FF0000')).toBe('#FF0000');
    });

    it('converts fully-opaque #AARRGGBB to #RRGGBB', () => {
        expect(argbToCss('#FF69B4FF')).toBe('#69B4FF');
    });

    it('converts semi-transparent #AARRGGBB to rgba()', () => {
        const result = argbToCss('#80FF0000');
        expect(result).toMatch(/^rgba\(255,0,0,0\.\d+\)$/);
        const alpha = parseFloat(result.match(/rgba\(255,0,0,(.+)\)/)![1]);
        expect(alpha).toBeCloseTo(0x80 / 255, 2);
    });

    it('converts fully-transparent alpha to rgba()', () => {
        const result = argbToCss('#00000000');
        expect(result).toBe('rgba(0,0,0,0.000)');
    });

    it('passes through non-hex color strings unchanged', () => {
        expect(argbToCss('red')).toBe('red');
        expect(argbToCss('transparent')).toBe('transparent');
    });

    it('handles #FFFFFFFF (fully opaque white) as #FFFFFF', () => {
        expect(argbToCss('#FFFFFFFF')).toBe('#FFFFFF');
    });
});

// ---------------------------------------------------------------------------
// parseMargin / parseThickness
// ---------------------------------------------------------------------------
describe('parseMargin', () => {
    it('parses single value as uniform margin', () => {
        expect(parseMargin('10')).toEqual([10, 10, 10, 10]);
    });

    it('parses two values as horizontal,vertical (XAML shorthand)', () => {
        expect(parseMargin('20,10')).toEqual([10, 20, 10, 20]);
    });

    it('parses four values as Left,Top,Right,Bottom → [T,R,B,L]', () => {
        expect(parseMargin('5,10,15,20')).toEqual([10, 15, 20, 5]);
    });

    it('handles negative values', () => {
        expect(parseMargin('0,-30,-30,0')).toEqual([-30, -30, 0, 0]);
    });

    it('returns zero for empty/malformed input', () => {
        expect(parseMargin('')).toEqual([0, 0, 0, 0]);
    });
});

describe('parseThickness', () => {
    it('parses single value', () => {
        expect(parseThickness('5')).toEqual([5, 5, 5, 5]);
    });

    it('parses L,T,R,B (four values)', () => {
        // BorderThickness="1,2,3,4" means L=1,T=2,R=3,B=4 → [T=2,R=3,B=4,L=1]
        expect(parseThickness('1,2,3,4')).toEqual([2, 3, 4, 1]);
    });

    it('parses H,V (two values)', () => {
        expect(parseThickness('4,2')).toEqual([2, 4, 2, 4]);
    });
});

// ---------------------------------------------------------------------------
// parseBootstrapperTheme — helpers
// ---------------------------------------------------------------------------

function makeXml(inner: string, attrs = 'Width="520" Height="320" Theme="Dark"') {
    return `<?xml version="1.0" encoding="utf-8"?><BloxstrapCustomBootstrapper ${attrs}>${inner}</BloxstrapCustomBootstrapper>`;
}

// ---------------------------------------------------------------------------
// parseBootstrapperTheme — basic parsing
// ---------------------------------------------------------------------------
describe('parseBootstrapperTheme', () => {
    it('returns null for invalid XML', () => {
        expect(parseBootstrapperTheme('<not-valid xml')).toBeNull();
    });

    it('returns null when root element is missing', () => {
        expect(parseBootstrapperTheme('<SomeOtherRoot/>')).toBeNull();
    });

    it('parses width, height, and dark theme', () => {
        const theme = parseBootstrapperTheme(makeXml(''));
        expect(theme).not.toBeNull();
        expect(theme!.width).toBe(520);
        expect(theme!.height).toBe(320);
        expect(theme!.mode).toBe('dark');
    });

    it('parses light theme mode', () => {
        const theme = parseBootstrapperTheme(makeXml('', 'Width="400" Height="300" Theme="Light"'));
        expect(theme!.mode).toBe('light');
    });

    it('falls back to system mode for unknown Theme attribute', () => {
        const theme = parseBootstrapperTheme(makeXml('', 'Width="400" Height="300" Theme="Default"'));
        expect(theme!.mode).toBe('system');
    });

    it('uses default dimensions when attributes are absent', () => {
        const theme = parseBootstrapperTheme('<BloxstrapCustomBootstrapper></BloxstrapCustomBootstrapper>');
        expect(theme!.width).toBe(500);
        expect(theme!.height).toBe(320);
    });

    it('parses SolidColorBrush root background', () => {
        const xml = makeXml('<BloxstrapCustomBootstrapper.Background><SolidColorBrush Color="#FF123456"/></BloxstrapCustomBootstrapper.Background>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.background).toBe('#123456');
    });

    it('parses ImageBrush root background with theme:// URL', () => {
        const xml = makeXml(`
            <BloxstrapCustomBootstrapper.Background>
                <ImageBrush ImageSource="theme://bg.jpg" Stretch="UniformToFill"/>
            </BloxstrapCustomBootstrapper.Background>
        `);
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.backgroundImage).toBeDefined();
        expect(theme!.backgroundImage!.url).toBe('theme://bg.jpg');
        expect(theme!.backgroundImage!.stretch).toBe('UniformToFill');
    });

    it('parses ImageBrush with {Icon} source', () => {
        const xml = makeXml(`
            <BloxstrapCustomBootstrapper.Background>
                <ImageBrush ImageSource="{Icon}" TileMode="Tile" ViewportUnits="Absolute" Viewport="0,0,64,64"/>
            </BloxstrapCustomBootstrapper.Background>
        `);
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.backgroundImage!.url).toBe('{Icon}');
        expect(theme!.backgroundImage!.tileMode).toBe('Tile');
        expect(theme!.backgroundImage!.viewport).toBe('0,0,64,64');
        expect(theme!.backgroundImage!.viewportUnits).toBe('Absolute');
    });

    it('parses root CornerRadius', () => {
        const theme = parseBootstrapperTheme(makeXml('', 'Width="520" Height="320" CornerRadius="12"'));
        expect(theme!.cornerRadius).toBe(12);
    });

    it('parses root Margin as containerPadding', () => {
        const theme = parseBootstrapperTheme(makeXml('', 'Width="520" Height="320" Margin="10,20,30,40"'));
        expect(theme!.containerPadding).toBe('20px 30px 40px 10px');
    });

    it('excludes TitleBar from elements', () => {
        const xml = makeXml('<TitleBar/><Grid/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements.every((e) => e.tag !== 'TitleBar')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// parseBootstrapperTheme — element parsing
// ---------------------------------------------------------------------------
describe('parseBootstrapperTheme — elements', () => {
    it('parses a TextBlock with Text attribute', () => {
        const xml = makeXml('<TextBlock Text="Hello World" FontSize="14" Foreground="#FF0000"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements).toHaveLength(1);
        const el = theme!.elements[0];
        expect(el.tag).toBe('TextBlock');
        expect(el.textContent).toBe('Hello World');
        expect(el.style).toContain('font-size: 14px');
        expect(el.style).toContain('color: #FF0000');
    });

    it('TextBlock defaults to text-align: center', () => {
        const xml = makeXml('<TextBlock Text="Hi"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('text-align: center');
    });

    it('TextBlock respects explicit TextAlignment', () => {
        const xml = makeXml('<TextBlock Text="Hi" TextAlignment="Left"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('text-align: left');
    });

    it('parses a ProgressBar and captures fg/bg colors', () => {
        const xml = makeXml(`
            <ProgressBar Name="PrimaryProgressBar" Height="5"
                Foreground="#FF69B4" Background="#333333"
                HorizontalAlignment="Stretch" VerticalAlignment="Bottom" Margin="0,0,0,10"/>
        `);
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.isProgressBar).toBe(true);
        expect(el.progressFgColor).toBe('#FF69B4');
        expect(el.progressBgColor).toBe('#333333');
        expect(el.style).toContain('bottom: 10px');
        expect(el.style).toContain('left: 0px');
        expect(el.style).toContain('right: 0px');
    });

    it('parses IsIndeterminate=True on ProgressBar', () => {
        const xml = makeXml('<ProgressBar IsIndeterminate="True" Height="10" Width="400" HorizontalAlignment="Center"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isProgressBar).toBe(true);
        expect(el.isIndeterminate).toBe(true);
    });

    it('parses IsIndeterminate=False on ProgressBar', () => {
        const xml = makeXml('<ProgressBar IsIndeterminate="False" Height="10" Width="400" HorizontalAlignment="Center"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isIndeterminate).toBe(false);
    });

    it('recognises Name="StatusText" as isStatusText', () => {
        const xml = makeXml('<TextBlock Name="StatusText" Text="Loading..."/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements[0].isStatusText).toBe(true);
    });

    it('recognises Name="CancelButton" as isCancelButton', () => {
        const xml = makeXml('<Button Name="CancelButton" Content="Cancel"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements[0].isCancelButton).toBe(true);
        expect(theme!.elements[0].textContent).toBe('Cancel');
    });

    it('recognises Source="{Icon}" as isIcon', () => {
        const xml = makeXml('<Image Source="{Icon}" Width="80" Height="80"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements[0].isIcon).toBe(true);
    });

    it('recognises theme:// Source as isThemeImage', () => {
        const xml = makeXml('<Image Source="theme://logo.png" Width="100" Height="50"/>');
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.isThemeImage).toBe(true);
        expect(el.source).toBe('theme://logo.png');
    });

    it('recognises IsAnimated=True on Image', () => {
        const xml = makeXml('<Image Source="theme://tenor.gif" IsAnimated="True" Stretch="Fill"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isAnimated).toBe(true);
    });

    it('applies CornerRadius with overflow:hidden to a Border', () => {
        const xml = makeXml('<Border CornerRadius="40" Width="80" Height="80"/>');
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.style).toContain('border-radius: 40px');
        expect(el.style).toContain('overflow: hidden');
    });

    it('applies 4-value CornerRadius correctly', () => {
        const xml = makeXml('<Border CornerRadius="4,8,12,16" Width="100" Height="50"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('border-radius: 4px 8px 12px 16px');
    });

    it('renders Rectangle with no size as width:100%/height:100%', () => {
        const xml = makeXml('<Rectangle><Rectangle.Fill><SolidColorBrush Color="#FF0000"/></Rectangle.Fill></Rectangle>');
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.style).toContain('width: 100%');
        expect(el.style).toContain('height: 100%');
        expect(el.style).toContain('background: #FF0000');
    });

    it('renders Rectangle with LinearGradientBrush Fill', () => {
        const xml = makeXml(`
            <Rectangle>
                <Rectangle.Fill>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
                        <GradientStop Color="#AA000000" Offset="0"/>
                        <GradientStop Color="#00000000" Offset="1"/>
                    </LinearGradientBrush>
                </Rectangle.Fill>
            </Rectangle>
        `);
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.style).toContain('linear-gradient(');
    });

    it('right-aligns with correct margin offset', () => {
        const xml = makeXml('<Border Width="150" Height="150" HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,-30,-30,0"/>');
        const theme = parseBootstrapperTheme(xml);
        const el = theme!.elements[0];
        expect(el.style).toContain('right: -30px');
    });

    it('parses nested children recursively', () => {
        const xml = makeXml(`
            <Grid>
                <Border Width="80" Height="80" CornerRadius="40">
                    <Image Source="theme://icon.png" Width="60" Height="60" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
            </Grid>
        `);
        const theme = parseBootstrapperTheme(xml);
        const grid = theme!.elements[0];
        expect(grid.tag).toBe('Grid');
        expect(grid.children).toHaveLength(1);
        const border = grid.children[0];
        expect(border.tag).toBe('Border');
        expect(border.style).toContain('border-radius: 40px');
        expect(border.children).toHaveLength(1);
        const img = border.children[0];
        expect(img.isThemeImage).toBe(true);
        expect(img.source).toBe('theme://icon.png');
    });

    it('extracts children from Button.Content property element', () => {
        const xml = makeXml(`
            <Button Name="CancelButton">
                <Button.Content>
                    <Image Source="theme://mini-teto.png" Stretch="Fill"/>
                </Button.Content>
            </Button>
        `);
        const theme = parseBootstrapperTheme(xml);
        const btn = theme!.elements[0];
        expect(btn.isCancelButton).toBe(true);
        expect(btn.children).toHaveLength(1);
        expect(btn.children[0].isThemeImage).toBe(true);
        expect(btn.children[0].source).toBe('theme://mini-teto.png');
    });

    it('parses theme:// font refs and builds @font-face data', () => {
        const xml = makeXml('<TextBlock FontFamily="theme://fonts/Custom.ttf#Custom Font" Text="Hello"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.fonts).toHaveLength(1);
        expect(theme!.fonts[0].themeUrl).toBe('theme://fonts/Custom.ttf');
        expect(theme!.fonts[0].family).toBe('Custom Font');
        expect(theme!.elements[0].style).toContain("font-family: 'Custom Font'");
    });

    it('handles Visibility="Collapsed" with display:none', () => {
        const xml = makeXml('<Border Visibility="Collapsed" Width="100" Height="50"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements[0].style).toContain('display: none');
    });

    it('normalises {Common.Cancel} text to Cancel', () => {
        const xml = makeXml('<Button Name="CancelButton" Content="{Common.Cancel}"/>');
        const theme = parseBootstrapperTheme(xml);
        expect(theme!.elements[0].textContent).toBe('Cancel');
    });

    it('resolves {Version} text to AppleBlox', () => {
        const xml = makeXml('<TextBlock Text="{Version}"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.textContent).toBe('AppleBlox');
    });

    it('parses deep nesting (3 levels) correctly', () => {
        const xml = makeXml(`
            <Grid>
                <Grid Height="120" VerticalAlignment="Bottom">
                    <ProgressBar Name="PrimaryProgressBar" Height="5" HorizontalAlignment="Stretch" Foreground="#FF69B4" Margin="0,0,0,0"/>
                </Grid>
            </Grid>
        `);
        const theme = parseBootstrapperTheme(xml);
        const outerGrid = theme!.elements[0];
        const innerGrid = outerGrid.children[0];
        expect(innerGrid.tag).toBe('Grid');
        const progressBar = innerGrid.children[0];
        expect(progressBar.isProgressBar).toBe(true);
        expect(progressBar.progressFgColor).toBe('#FF69B4');
    });
});

// ---------------------------------------------------------------------------
// New features: transforms, effects, WPF resources, layout
// ---------------------------------------------------------------------------
describe('parseBootstrapperTheme — new features', () => {
    it('Panel.ZIndex → z-index in style', () => {
        const xml = makeXml('<ProgressBar Panel.ZIndex="123" Height="10" Width="400" HorizontalAlignment="Center"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('z-index: 123');
    });

    it('Panel.ZIndex clamped to 1000', () => {
        const xml = makeXml('<Border Panel.ZIndex="9999" Width="10" Height="10"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('z-index: 1000');
    });

    it('RotateTransform → CSS transform rotate', () => {
        const xml = makeXml(`
            <Image Source="{Icon}" Width="100" Height="100">
                <Image.RenderTransform>
                    <RotateTransform Angle="45"/>
                </Image.RenderTransform>
            </Image>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('rotate(45deg)');
    });

    it('RotateTransform with CenterX/CenterY → decomposed translate', () => {
        const xml = makeXml(`
            <Image Source="{Icon}" Width="100" Height="100">
                <Image.RenderTransform>
                    <RotateTransform Angle="10" CenterX="50" CenterY="50"/>
                </Image.RenderTransform>
            </Image>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('translate(50px,50px)');
        expect(el.style).toContain('rotate(10deg)');
        expect(el.style).toContain('translate(-50px,-50px)');
    });

    it('ScaleTransform → CSS transform scale', () => {
        const xml = makeXml(`
            <TextBlock Text="Hi">
                <TextBlock.RenderTransform>
                    <ScaleTransform ScaleY="4" CenterY="40"/>
                </TextBlock.RenderTransform>
            </TextBlock>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('scale(');
    });

    it('SkewTransform → CSS transform skewX skewY', () => {
        const xml = makeXml(`
            <Image Source="{Icon}" Width="100" Height="100">
                <Image.RenderTransform>
                    <SkewTransform AngleX="19" AngleY="23"/>
                </Image.RenderTransform>
            </Image>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('skewX(19deg)');
        expect(el.style).toContain('skewY(23deg)');
    });

    it('TranslateTransform → CSS transform translate', () => {
        const xml = makeXml(`
            <Border Width="50" Height="50">
                <Border.RenderTransform>
                    <TranslateTransform X="10" Y="20"/>
                </Border.RenderTransform>
            </Border>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('translate(10px,20px)');
    });

    it('Multiple transforms in RenderTransform property element', () => {
        const xml = makeXml(`
            <Button Name="CancelButton" Height="40" Width="100" HorizontalAlignment="Center" Margin="0,225,0,0">
                <Button.RenderTransform>
                    <RotateTransform Angle="50" CenterX="100"/>
                    <ScaleTransform ScaleY="4" CenterY="0"/>
                </Button.RenderTransform>
            </Button>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('rotate(50deg)');
        expect(el.style).toContain('scale(');
    });

    it('BlurEffect → CSS filter blur', () => {
        const xml = makeXml(`
            <Border Width="100" Height="100">
                <Border.Effect>
                    <BlurEffect Radius="8"/>
                </Border.Effect>
            </Border>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('filter: blur(8px)');
    });

    it('DropShadowEffect → CSS filter drop-shadow', () => {
        const xml = makeXml(`
            <Rectangle Width="100" Height="100">
                <Rectangle.Effect>
                    <DropShadowEffect/>
                </Rectangle.Effect>
            </Rectangle>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('filter: drop-shadow(');
    });

    it('{TextFillColorPrimaryBrush} → var(--wpf-text-primary)', () => {
        const xml = makeXml('<TextBlock Text="Hi" Foreground="{TextFillColorPrimaryBrush}"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('color: var(--wpf-text-primary)');
    });

    it('named WPF color LimeGreen resolves to limegreen', () => {
        const xml = makeXml('<Rectangle><Rectangle.Fill><SolidColorBrush Color="LimeGreen"/></Rectangle.Fill></Rectangle>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('background: limegreen');
    });

    it('named WPF color Yellow resolves to yellow', () => {
        const xml = makeXml('<TextBlock Text="Hi" Foreground="Yellow"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('color: yellow');
    });

    it('BorderBrush + BorderThickness → CSS border', () => {
        const xml = makeXml('<Button Name="CancelButton" BorderBrush="Blue" BorderThickness="4"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('border:');
        expect(el.style).toContain('blue');
    });

    it('FontWeight SemiBold → font-weight: 600', () => {
        const xml = makeXml('<TextBlock Text="Bold" FontWeight="SemiBold"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('font-weight: 600');
    });

    it('FontWeight Bold → font-weight: 700', () => {
        const xml = makeXml('<TextBlock Text="Bold" FontWeight="Bold"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('font-weight: 700');
    });

    it('FontStyle Oblique → font-style: oblique', () => {
        const xml = makeXml('<TextBlock Name="StatusText" FontStyle="Oblique"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('font-style: oblique');
    });

    it('TextWrapping=Wrap → white-space: pre-wrap', () => {
        const xml = makeXml('<TextBlock Text="Hello" TextWrapping="Wrap"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('white-space: pre-wrap');
    });

    it('TextDecorations=Underline → text-decoration: underline', () => {
        const xml = makeXml('<TextBlock Text="Hello" TextDecorations="Underline"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('text-decoration: underline');
    });

    it('ProgressRing tag → isProgressRing=true', () => {
        const xml = makeXml('<ProgressRing Name="PrimaryProgressRing" Width="50" Height="50"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isProgressRing).toBe(true);
    });

    it('ProgressRing IsIndeterminate → isIndeterminate=true', () => {
        const xml = makeXml('<ProgressRing IsIndeterminate="True" Width="50" Height="50"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isProgressRing).toBe(true);
        expect(el.isIndeterminate).toBe(true);
    });

    it('Grid with RowDefinitions → layoutMode=grid and style contains grid-template-rows', () => {
        const xml = makeXml(`
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="*"/>
                    <RowDefinition Height="50"/>
                </Grid.RowDefinitions>
            </Grid>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.layoutMode).toBe('grid');
        expect(el.style).toContain('display: grid');
        expect(el.gridTemplateRows).toBe('auto 1fr 50px');
    });

    it('Grid with ColumnDefinitions → gridTemplateColumns populated', () => {
        const xml = makeXml(`
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="200"/>
                    <ColumnDefinition Width="*"/>
                </Grid.ColumnDefinitions>
            </Grid>
        `);
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.layoutMode).toBe('grid');
        expect(el.gridTemplateColumns).toBe('200px 1fr');
    });

    it('Grid child with Grid.Row/Grid.Column → grid-row/grid-column in style', () => {
        const xml = makeXml(`
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height="*"/>
                    <RowDefinition Height="*"/>
                </Grid.RowDefinitions>
                <TextBlock Text="Row2" Grid.Row="1"/>
            </Grid>
        `);
        const grid = parseBootstrapperTheme(xml)!.elements[0];
        const child = grid.children[0];
        expect(child.style).toContain('grid-row: 2 / span 1');
    });

    it('StackPanel Vertical → style contains display:flex and flex-direction:column', () => {
        const xml = makeXml('<StackPanel Orientation="Vertical"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.layoutMode).toBe('flex');
        expect(el.style).toContain('display: flex');
        expect(el.style).toContain('flex-direction: column');
        expect(el.flexDirection).toBe('column');
    });

    it('StackPanel Horizontal → flex-direction:row', () => {
        const xml = makeXml('<StackPanel Orientation="Horizontal"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.style).toContain('flex-direction: row');
        expect(el.flexDirection).toBe('row');
    });

    it('Line element → isLine=true with lineGeometry', () => {
        const xml = makeXml('<Line X1="0" Y1="0" X2="100" Y2="50" Stroke="#FF0000" StrokeThickness="2"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.isLine).toBe(true);
        expect(el.lineGeometry).toBeDefined();
        expect(el.lineGeometry!.x1).toBe(0);
        expect(el.lineGeometry!.y2).toBe(50);
        expect(el.lineGeometry!.strokeWidth).toBe(2);
    });

    it('Rectangle with Stroke → shapeStroke populated', () => {
        const xml = makeXml('<Rectangle Width="100" Height="50" Stroke="#FF0000" StrokeThickness="3"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.shapeStroke).toBe('#FF0000');
        expect(el.shapeStrokeWidth).toBe(3);
    });

    it('Rectangle RadiusX/RadiusY → shapeRadiusX/shapeRadiusY', () => {
        const xml = makeXml('<Rectangle Width="100" Height="50" RadiusX="10" RadiusY="5"/>');
        const el = parseBootstrapperTheme(xml)!.elements[0];
        expect(el.shapeRadiusX).toBe(10);
        expect(el.shapeRadiusY).toBe(5);
    });
});
