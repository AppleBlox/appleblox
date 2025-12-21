import { describe, expect, it } from 'bun:test';
import { escapeShellArg, buildCommand } from './shell';

describe('Shell Utilities', () => {
	describe('escapeShellArg', () => {
		it('should escape single quotes', () => {
			const result = escapeShellArg("it's");
			expect(result).toBe("'it'\\''s'");
		});

		it('should wrap plain strings in single quotes', () => {
			const result = escapeShellArg('hello');
			expect(result).toBe("'hello'");
		});

		it('should handle empty strings', () => {
			const result = escapeShellArg('');
			expect(result).toBe("''");
		});

		it('should handle strings with spaces', () => {
			const result = escapeShellArg('hello world');
			expect(result).toBe("'hello world'");
		});

		it('should handle strings with special characters', () => {
			const result = escapeShellArg('hello $USER');
			expect(result).toBe("'hello $USER'");
		});

		it('should handle numbers', () => {
			const result = escapeShellArg(42);
			expect(result).toBe("'42'");
		});

		it('should prevent command injection with backticks', () => {
			const result = escapeShellArg('`whoami`');
			expect(result).toBe("'`whoami`'");
		});

		it('should prevent command injection with $(...)', () => {
			const result = escapeShellArg('$(whoami)');
			expect(result).toBe("'$(whoami)'");
		});

		it('should handle semicolons safely', () => {
			const result = escapeShellArg('hello; rm -rf /');
			expect(result).toBe("'hello; rm -rf /'");
		});

		it('should handle pipes safely', () => {
			const result = escapeShellArg('hello | cat');
			expect(result).toBe("'hello | cat'");
		});

		it('should handle redirect safely', () => {
			const result = escapeShellArg('hello > /etc/passwd');
			expect(result).toBe("'hello > /etc/passwd'");
		});

		it('should handle newlines safely', () => {
			const result = escapeShellArg('line1\nline2');
			expect(result).toBe("'line1\nline2'");
		});
	});

	describe('buildCommand', () => {
		it('should build command with no arguments', () => {
			const result = buildCommand('ls', []);
			expect(result).toBe("'ls' ");
		});

		it('should build command with single argument', () => {
			const result = buildCommand('echo', ['hello']);
			expect(result).toBe("'echo' 'hello'");
		});

		it('should build command with multiple arguments', () => {
			const result = buildCommand('cp', ['file1.txt', 'file2.txt']);
			expect(result).toBe("'cp' 'file1.txt' 'file2.txt'");
		});

		it('should escape command name', () => {
			const result = buildCommand('test command', ['arg']);
			expect(result).toBe("'test command' 'arg'");
		});

		it('should escape all arguments', () => {
			const result = buildCommand('echo', ["it's", 'a test']);
			expect(result).toBe("'echo' 'it'\\''s' 'a test'");
		});

		it('should handle numeric arguments', () => {
			const result = buildCommand('kill', [-9, 1234]);
			expect(result).toBe("'kill' '-9' '1234'");
		});

		it('should prevent injection through arguments', () => {
			const result = buildCommand('echo', ['hello; rm -rf /']);
			expect(result).toBe("'echo' 'hello; rm -rf /'");
		});

		it('should handle paths with spaces', () => {
			const result = buildCommand('cd', ['/Users/test/My Documents']);
			expect(result).toBe("'cd' '/Users/test/My Documents'");
		});

		it('should handle complex injection attempt', () => {
			const maliciousArg = "'; cat /etc/passwd #";
			const result = buildCommand('echo', [maliciousArg]);
			expect(result).toBe("'echo' ''\\''; cat /etc/passwd #'");
		});
	});
});
