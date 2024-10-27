import path from 'path-browserify';
import { getConfigPath } from '../settings';
import shellFS from '../../ts/tools/shellfs';

export async function readCssFile(): Promise<string> {
	const cssFilePath = path.join(path.dirname(await getConfigPath()), 'theme.css');
	if (!(await shellFS.exists(cssFilePath))) {
		await shellFS.writeFile(cssFilePath, '');
	}
	return await shellFS.readFile(cssFilePath);
}

export async function revealCssFile() {
	const cssFilePath = path.join(path.dirname(await getConfigPath()), 'theme.css');
	await shellFS.open(cssFilePath, { reveal: true });
}

export async function loadTheme() {
	try {
		const cssContent = await readCssFile();
		let styleElement = document.getElementById('theme-global-css');
		if (!styleElement) {
			styleElement = document.createElement('style');
			styleElement.id = 'theme-global-css';
			document.head.appendChild(styleElement);
		}
		styleElement.innerHTML = cssContent;
	} catch (err) {
		console.error("Couldn't load CSS theme:", err);
	}
}

export async function setTheme(css: string) {
	const cssFilePath = path.join(path.dirname(await getConfigPath()), 'theme.css');
	await shellFS.writeFile(cssFilePath, css);
	await loadTheme();
}
