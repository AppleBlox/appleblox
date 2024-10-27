type MacArch = 'x64' | 'arm64' | 'universal';
type LinuxArch = 'x64' | 'arm64' | 'armhf';

export interface Config {
	devPort: number;
	projectPath: string;
	outDir: string;
	appName: string;
	description: string;
	appBundleName: string;
	mac?: {
		architecture: MacArch[];
		minimumOS: string;
		appIcon: string;
	};
	win?: {
		architecture: 'x64'[];
		appIcon: string;
		embedResources: boolean;
	};
	linux?: {
		architecture: LinuxArch[];
		appIcon: string;
		appPath: string;
		appIconPath: string;
	};
}
