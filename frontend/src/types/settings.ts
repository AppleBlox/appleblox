import type { ComponentType, SvelteComponent } from 'svelte';

export type InteractableOptions = {
	type: 'boolean';
};

export interface FFlag {
	flag: string;
	enabled: boolean;
	value: string;
}

export interface Icon {
	component?: ComponentType<SvelteComponent>;
	props?: string;
	src?: string;
}

export interface SettingsPanel {
	name: string;
	description: string;
	id: string;
	sections?: {
		name: string;
		description: string;
		id: string;
		interactables?: {
			label: string;
			description: string;
			id: string;
			hideTitle?: boolean;
			toggle?: string
			options:
				| { type: 'boolean'; state: boolean }
				| { type: 'none' }
				| { type: 'string'; default: string }
				| { type: 'file'; accept: string[]; default?: string }
				| { type: 'dropdown'; list: { label: string; value: string }[]; default: { label: string; value: string } }
				| { type: 'number'; default: number; max: number; min: number; step: number }
				| {
						type: 'button';
						style: 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'default';
						icon?: Icon;
				  }
				| {
						type: 'ff_buttons_custom';
				  }
				| {
						type: 'mods_ui';
				  };
		}[];
	}[];
}
