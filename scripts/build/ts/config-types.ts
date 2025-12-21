type MacArch = 'x64' | 'arm64' | 'universal';

export interface Config {
	devPort: number;
	projectPath: string;
	outDir: string;
	appName: string;
	description: string;
	appBundleName: string;
	mac: {
		architecture: MacArch[];
		minimumOS: string;
		appIcon: string;
	};
}
