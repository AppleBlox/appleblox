import { describe, expect, it, mock } from 'bun:test';
import { hexToRgb, rgbToHex } from './font-colorizer';

// Mock Neutralino modules
mock.module('@neutralinojs/lib', () => ({
	os: {
		getEnv: mock(() => Promise.resolve('/Users/test')),
	},
	filesystem: {
		readBinaryFile: mock(() => Promise.resolve(new ArrayBuffer(0))),
		writeBinaryFile: mock(() => Promise.resolve()),
	},
	events: {},
	window: {},
	init: () => {},
}));

describe('Font Colorizer', () => {
	describe('hexToRgb', () => {
		it('should convert a valid hex color to RGB', () => {
			const result = hexToRgb('#FF5500');
			expect(result).toEqual({ r: 255, g: 85, b: 0 });
		});

		it('should handle hex colors without # prefix', () => {
			const result = hexToRgb('FF5500');
			expect(result).toEqual({ r: 255, g: 85, b: 0 });
		});

		it('should convert white correctly', () => {
			const result = hexToRgb('#FFFFFF');
			expect(result).toEqual({ r: 255, g: 255, b: 255 });
		});

		it('should convert black correctly', () => {
			const result = hexToRgb('#000000');
			expect(result).toEqual({ r: 0, g: 0, b: 0 });
		});

		it('should handle lowercase hex', () => {
			const result = hexToRgb('#ff5500');
			expect(result).toEqual({ r: 255, g: 85, b: 0 });
		});

		it('should handle mixed case hex', () => {
			const result = hexToRgb('#Ff55aA');
			expect(result).toEqual({ r: 255, g: 85, b: 170 });
		});

		it('should throw for invalid hex (too short)', () => {
			expect(() => hexToRgb('#FFF')).toThrow('Invalid hex color');
		});

		it('should throw for invalid hex (too long)', () => {
			expect(() => hexToRgb('#FFFFFFF')).toThrow('Invalid hex color');
		});

		it('should throw for invalid characters', () => {
			expect(() => hexToRgb('#GGGGGG')).toThrow('Invalid hex color');
		});
	});

	describe('rgbToHex', () => {
		it('should convert RGB to hex', () => {
			const result = rgbToHex({ r: 255, g: 85, b: 0 });
			expect(result).toBe('#ff5500');
		});

		it('should convert white correctly', () => {
			const result = rgbToHex({ r: 255, g: 255, b: 255 });
			expect(result).toBe('#ffffff');
		});

		it('should convert black correctly', () => {
			const result = rgbToHex({ r: 0, g: 0, b: 0 });
			expect(result).toBe('#000000');
		});

		it('should pad single digit values with zero', () => {
			const result = rgbToHex({ r: 0, g: 5, b: 15 });
			expect(result).toBe('#00050f');
		});

		it('should clamp values above 255', () => {
			const result = rgbToHex({ r: 300, g: 255, b: 255 });
			expect(result).toBe('#ffffff');
		});

		it('should clamp negative values to 0', () => {
			const result = rgbToHex({ r: -10, g: 0, b: 0 });
			expect(result).toBe('#000000');
		});
	});

});
